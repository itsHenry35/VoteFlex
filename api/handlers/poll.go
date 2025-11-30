package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/api/middlewares"
	"github.com/itsHenry35/VoteFlex/models"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
)

// OptionInput 选项输入
type OptionInput struct {
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
	AudioURL string `json:"audio_url"`
	VideoURL string `json:"video_url"`
}

// Validate 验证选项至少有一个字段有值
func (o *OptionInput) Validate() bool {
	return o.Text != "" || o.ImageURL != "" || o.AudioURL != "" || o.VideoURL != ""
}

// CreatePollRequest 创建投票请求
type CreatePollRequest struct {
	Title             string  `json:"title" binding:"required"`
	Description       string  `json:"description"`
	IdentityType      string  `json:"identity_type" binding:"required"`  // none/dingtalk/ip
	FrequencyType     string  `json:"frequency_type" binding:"required"` // total/hourly/daily
	FrequencyN        int     `json:"frequency_n"`                       // 每N小时/天
	FrequencyMax      int     `json:"frequency_max"`                     // 最多投票次数
	MinVotes          int     `json:"min_votes"`                         // 最少选几项
	MaxVotes          int     `json:"max_votes"`                         // 最多选几项
	StartTime         *string `json:"start_time"`
	EndTime           *string `json:"end_time"`
	ShowResults       bool    `json:"show_results"`       // 是否公开展示投票结果
	AllowModification bool    `json:"allow_modification"` // 是否允许修改投票
}

// UpdatePollRequest 更新投票请求
type UpdatePollRequest struct {
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	FrequencyType     string  `json:"frequency_type"`
	FrequencyN        *int    `json:"frequency_n"`
	FrequencyMax      *int    `json:"frequency_max"`
	StartTime         *string `json:"start_time"`
	EndTime           *string `json:"end_time"`
	ShowResults       *bool   `json:"show_results"`
	AllowModification *bool   `json:"allow_modification"`
	MinVotes          *int    `json:"min_votes"`
	MaxVotes          *int    `json:"max_votes"`
}

// SetShortCodeRequest 设置短链接请求
type SetShortCodeRequest struct {
	ShortCode string `json:"short_code" binding:"required"`
}

// CreatePoll 创建投票
func CreatePoll(c *gin.Context) {
	var req CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求: "+err.Error())
		return
	}

	// 验证身份验证类型
	identityType := types.IdentityType(req.IdentityType)
	if identityType != types.IdentityTypeNone &&
		identityType != types.IdentityTypeDingTalk &&
		identityType != types.IdentityTypeIP {
		utils.ResponseError(c, http.StatusBadRequest, "无效的身份验证类型")
		return
	}

	// 验证频率类型
	frequencyType := types.FrequencyType(req.FrequencyType)
	if frequencyType != types.FrequencyTypeTotal &&
		frequencyType != types.FrequencyTypeHourly &&
		frequencyType != types.FrequencyTypeDaily {
		utils.ResponseError(c, http.StatusBadRequest, "无效的频率类型")
		return
	}

	// 设置默认值
	if req.FrequencyN <= 0 {
		req.FrequencyN = 1
	}
	if req.FrequencyMax <= 0 {
		req.FrequencyMax = 1
	}
	if req.MinVotes <= 0 {
		req.MinVotes = 1
	}
	if req.MaxVotes <= 0 {
		req.MaxVotes = 1
	}
	if req.MaxVotes < req.MinVotes {
		req.MaxVotes = req.MinVotes
	}

	// 解析时间
	var startTime, endTime *time.Time
	if req.StartTime != nil && *req.StartTime != "" {
		t, err := time.Parse(time.RFC3339, *req.StartTime)
		if err != nil {
			utils.ResponseError(c, http.StatusBadRequest, "无效的开始时间格式")
			return
		}
		startTime = &t
	}
	if req.EndTime != nil && *req.EndTime != "" {
		t, err := time.Parse(time.RFC3339, *req.EndTime)
		if err != nil {
			utils.ResponseError(c, http.StatusBadRequest, "无效的结束时间格式")
			return
		}
		endTime = &t
	}

	// 获取创建者ID
	creatorID, _ := middlewares.GetUserIDFromContext(c)

	// 创建投票（不包含选项）
	poll, err := models.CreatePoll(
		req.Title,
		req.Description,
		identityType,
		frequencyType,
		req.FrequencyN,
		req.FrequencyMax,
		req.MinVotes,
		req.MaxVotes,
		startTime,
		endTime,
		req.ShowResults,
		req.AllowModification,
		creatorID,
		nil, // 不创建任何选项
	)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "创建投票失败: "+err.Error())
		return
	}

	utils.ResponseOK(c, poll)
}

// GetMyPolls 获取当前用户创建的投票
func GetMyPolls(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	userID, _ := middlewares.GetUserIDFromContext(c)

	polls, total, err := models.GetPollsByCreatorID(userID, page, pageSize)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取投票列表失败")
		return
	}

	utils.ResponsePaginated(c, polls, total, page, pageSize)
}

// GetMyPoll 获取单个投票详情（仅限自己创建的）
func GetMyPoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以查看
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限查看此投票")
		return
	}

	utils.ResponseOK(c, poll)
}

// GetAllPolls 获取所有投票（管理员）
func GetAllPolls(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	polls, total, err := models.GetAllPolls(page, pageSize)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取投票列表失败")
		return
	}

	utils.ResponsePaginated(c, polls, total, page, pageSize)
}

// GetPollByUUID 通过UUID获取投票详情（公开接口）
func GetPollByUUID(c *gin.Context) {
	uuid := c.Param("uuid")

	poll, err := models.GetPollByUUID(uuid)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	utils.ResponseOK(c, poll)
}

// GetPollByShortCode 通过短链接代码获取投票详情（公开接口）
func GetPollByShortCode(c *gin.Context) {
	shortCode := c.Param("code")

	poll, err := models.GetPollByShortCode(shortCode)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	utils.ResponseOK(c, poll)
}

// GetPoll 获取投票详情
func GetPoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	utils.ResponseOK(c, poll)
}

// GetPollResults 获取投票结果（按票数排序）
func GetPollResults(c *gin.Context) {
	uuid := c.Param("uuid")

	poll, err := models.GetPollByUUID(uuid)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查是否公开结果
	if !poll.ShowResults && poll.Status != types.PollStatusEnded {
		utils.ResponseError(c, http.StatusForbidden, "投票结果未公开")
		return
	}

	options, err := models.GetOptionsByPollID(poll.ID)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取投票结果失败")
		return
	}

	// 计算总票数
	totalVotes := 0
	for _, opt := range options {
		totalVotes += opt.VoteCount
	}

	utils.ResponseOK(c, map[string]interface{}{
		"poll":        poll,
		"options":     options,
		"total_votes": totalVotes,
	})
}

// UpdatePoll 更新投票
func UpdatePoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	var req UpdatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以修改
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限修改此投票")
		return
	}

	if req.Title != "" {
		poll.Title = req.Title
	}
	if req.Description != "" {
		poll.Description = req.Description
	}
	if req.FrequencyType != "" {
		// 验证频率类型
		frequencyType := types.FrequencyType(req.FrequencyType)
		if frequencyType != types.FrequencyTypeTotal &&
			frequencyType != types.FrequencyTypeHourly &&
			frequencyType != types.FrequencyTypeDaily {
			utils.ResponseError(c, http.StatusBadRequest, "无效的频率类型")
			return
		}
		poll.FrequencyType = frequencyType
	}
	if req.FrequencyN != nil {
		poll.FrequencyN = *req.FrequencyN
	}
	if req.FrequencyMax != nil {
		poll.FrequencyMax = *req.FrequencyMax
	}
	if req.ShowResults != nil {
		poll.ShowResults = *req.ShowResults
	}
	if req.AllowModification != nil {
		poll.AllowModification = *req.AllowModification
	}
	if req.MinVotes != nil {
		poll.MinVotes = *req.MinVotes
	}
	if req.MaxVotes != nil {
		poll.MaxVotes = *req.MaxVotes
	}
	if req.StartTime != nil {
		if *req.StartTime == "" {
			poll.StartTime = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.StartTime)
			if err != nil {
				utils.ResponseError(c, http.StatusBadRequest, "无效的开始时间格式")
				return
			}
			poll.StartTime = &t
		}
	}
	if req.EndTime != nil {
		if *req.EndTime == "" {
			poll.EndTime = nil
		} else {
			t, err := time.Parse(time.RFC3339, *req.EndTime)
			if err != nil {
				utils.ResponseError(c, http.StatusBadRequest, "无效的结束时间格式")
				return
			}
			poll.EndTime = &t
		}
	}

	if err := models.UpdatePoll(poll); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "更新投票失败")
		return
	}

	// 重新获取投票以包含更新后的选项
	updatedPoll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取更新后的投票失败")
		return
	}

	utils.ResponseOK(c, updatedPoll)
}

// DeletePoll 删除投票
func DeletePoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以删除
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限删除此投票")
		return
	}

	if err := models.DeletePoll(id); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "删除投票失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "删除成功")
}

// EndPoll 提前结束投票
func EndPoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以结束
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限结束此投票")
		return
	}

	if err := models.EndPoll(id); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "结束投票失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "投票已结束")
}

// ReopenPoll 重新开启投票
func ReopenPoll(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以重新开启
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限重新开启此投票")
		return
	}

	if err := models.ReopenPoll(id); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "重新开启投票失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "投票已重新开启")
}

// SetShortCode 设置投票短链接
func SetShortCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	var req SetShortCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	poll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以设置短链接
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限设置此投票的短链接")
		return
	}

	// 验证短链接格式（只允许字母、数字、下划线、连字符）
	if !isValidShortCode(req.ShortCode) {
		utils.ResponseError(c, http.StatusBadRequest, "短链接只能包含字母、数字、下划线和连字符")
		return
	}

	// 检查短链接是否已被使用
	if err := models.CheckShortCodeExists(req.ShortCode, id); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "此短链接已被使用")
		return
	}

	// 更新短链接
	if err := models.SetPollShortCode(id, req.ShortCode); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "设置短链接失败")
		return
	}

	// 重新获取投票数据
	updatedPoll, err := models.GetPollByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取更新后的投票失败")
		return
	}

	utils.ResponseOK(c, updatedPoll)
}

// isValidShortCode 验证短链接格式
func isValidShortCode(shortCode string) bool {
	if len(shortCode) < 3 || len(shortCode) > 20 {
		return false
	}
	for _, r := range shortCode {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-') {
			return false
		}
	}
	return true
}

// AddOptionRequest 添加选项请求
type AddOptionRequest struct {
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
	AudioURL string `json:"audio_url"`
	VideoURL string `json:"video_url"`
}

// UpdateOptionRequest 更新选项请求
type UpdateOptionRequest struct {
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
	AudioURL string `json:"audio_url"`
	VideoURL string `json:"video_url"`
}

// UpdateOptionOrderRequest 更新选项顺序请求
type UpdateOptionOrderRequest struct {
	OptionID int `json:"option_id" binding:"required"`
	NewOrder int `json:"new_order"` // 不使用required，因为0是有效值
}

// AddOption 添加选项
func AddOption(c *gin.Context) {
	pollID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	poll, err := models.GetPollByID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以添加选项
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限添加选项")
		return
	}

	// 获取表单数据
	text := c.PostForm("text")
	imageURL := c.PostForm("image_url")
	audioURL := c.PostForm("audio_url")
	videoURL := c.PostForm("video_url")

	// 处理文件上传
	if imageFile, err := c.FormFile("image_file"); err == nil {
		url, uploadErr := utils.SaveUploadedFile(imageFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传图片失败: "+uploadErr.Error())
			return
		}
		imageURL = url
	}

	if audioFile, err := c.FormFile("audio_file"); err == nil {
		url, uploadErr := utils.SaveUploadedFile(audioFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传音频失败: "+uploadErr.Error())
			return
		}
		audioURL = url
	}

	if videoFile, err := c.FormFile("video_file"); err == nil {
		url, uploadErr := utils.SaveUploadedFile(videoFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传视频失败: "+uploadErr.Error())
			return
		}
		videoURL = url
	}

	// 验证选项至少有一个字段有值
	if text == "" && imageURL == "" && audioURL == "" && videoURL == "" {
		utils.ResponseError(c, http.StatusBadRequest, "选项至少需要包含文字、图片、音频或视频中的一项")
		return
	}

	option, err := models.AddOption(pollID, text, imageURL, audioURL, videoURL)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "添加选项失败")
		return
	}

	utils.ResponseOK(c, option)
}

// DeleteOption 删除选项
func DeleteOption(c *gin.Context) {
	pollID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	optionID, err := strconv.Atoi(c.Param("option_id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的选项ID")
		return
	}

	poll, err := models.GetPollByID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以删除选项
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限删除选项")
		return
	}

	// 检查是否至少保留2个选项
	options, err := models.GetOptionsByPollID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取选项失败")
		return
	}
	if len(options) <= 2 {
		utils.ResponseError(c, http.StatusBadRequest, "至少需要保留两个选项")
		return
	}

	if err := models.DeleteOption(optionID); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "删除选项失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "删除成功")
}

// UpdateOption 更新选项
func UpdateOption(c *gin.Context) {
	pollID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	optionID, err := strconv.Atoi(c.Param("option_id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的选项ID")
		return
	}

	poll, err := models.GetPollByID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以更新选项
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限更新选项")
		return
	}

	// 获取当前选项
	currentOption, err := models.GetOptionByID(optionID)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "选项不存在")
		return
	}

	// 获取表单数据
	text := c.PostForm("text")
	imageURL := currentOption.ImageURL
	audioURL := currentOption.AudioURL
	videoURL := currentOption.VideoURL

	// 处理删除标记
	if c.PostForm("delete_image") == "true" {
		// 删除旧文件
		if currentOption.ImageURL != "" {
			utils.DeleteUploadedFile(currentOption.ImageURL)
		}
		imageURL = ""
	}
	if c.PostForm("delete_audio") == "true" {
		// 删除旧文件
		if currentOption.AudioURL != "" {
			utils.DeleteUploadedFile(currentOption.AudioURL)
		}
		audioURL = ""
	}
	if c.PostForm("delete_video") == "true" {
		// 删除旧文件
		if currentOption.VideoURL != "" {
			utils.DeleteUploadedFile(currentOption.VideoURL)
		}
		videoURL = ""
	}

	// 处理文件上传
	if imageFile, err := c.FormFile("image_file"); err == nil {
		// 如果有旧文件，先删除
		if currentOption.ImageURL != "" {
			utils.DeleteUploadedFile(currentOption.ImageURL)
		}
		url, uploadErr := utils.SaveUploadedFile(imageFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传图片失败: "+uploadErr.Error())
			return
		}
		imageURL = url
	}

	if audioFile, err := c.FormFile("audio_file"); err == nil {
		// 如果有旧文件，先删除
		if currentOption.AudioURL != "" {
			utils.DeleteUploadedFile(currentOption.AudioURL)
		}
		url, uploadErr := utils.SaveUploadedFile(audioFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传音频失败: "+uploadErr.Error())
			return
		}
		audioURL = url
	}

	if videoFile, err := c.FormFile("video_file"); err == nil {
		// 如果有旧文件，先删除
		if currentOption.VideoURL != "" {
			utils.DeleteUploadedFile(currentOption.VideoURL)
		}
		url, uploadErr := utils.SaveUploadedFile(videoFile)
		if uploadErr != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "上传视频失败: "+uploadErr.Error())
			return
		}
		videoURL = url
	}

	// 验证选项至少有一个字段有值
	if text == "" && imageURL == "" && audioURL == "" && videoURL == "" {
		utils.ResponseError(c, http.StatusBadRequest, "选项至少需要包含文字、图片、音频或视频中的一项")
		return
	}

	option, err := models.UpdateOption(optionID, text, imageURL, audioURL, videoURL)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "更新选项失败")
		return
	}

	utils.ResponseOK(c, option)
}

// UpdateOptionOrder 更新选项顺序
func UpdateOptionOrder(c *gin.Context) {
	pollID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	var req UpdateOptionOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求: "+err.Error())
		return
	}

	// 手动验证 new_order（因为0是有效值，不能用binding:"required"）
	if req.NewOrder < 0 {
		utils.ResponseError(c, http.StatusBadRequest, "new_order不能为负数")
		return
	}

	poll, err := models.GetPollByID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 检查权限：只有创建者或管理员可以更新顺序
	userID, _ := middlewares.GetUserIDFromContext(c)
	if poll.CreatorID != userID && !middlewares.IsAdmin(c) {
		utils.ResponseError(c, http.StatusForbidden, "没有权限更新选项顺序")
		return
	}

	if err := models.UpdateOptionOrder(pollID, req.OptionID, req.NewOrder); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "更新选项顺序失败")
		return
	}

	// 返回更新后的所有选项
	options, err := models.GetOptionsByPollID(pollID)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取选项失败")
		return
	}

	utils.ResponseOK(c, options)
}
