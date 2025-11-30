package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/models"
	"github.com/itsHenry35/VoteFlex/services"
	"github.com/itsHenry35/VoteFlex/utils"
)

// VoteRequest 投票请求
type VoteRequest struct {
	OptionIDs     []int  `json:"option_ids" binding:"required,min=1"` // 选项ID列表（支持多选）
	DingTalkToken string `json:"dingtalk_token"`                      // 钉钉投票者令牌（可选）
}

// ModifyVoteRequest 修改投票请求
type ModifyVoteRequest struct {
	ModificationToken string `json:"modification_token" binding:"required"` // 修改令牌
	OptionIDs         []int  `json:"option_ids" binding:"required,min=1"`   // 新的选项ID列表
	DingTalkToken     string `json:"dingtalk_token"`                        // 钉钉投票者令牌（可选）
}

// Vote 进行投票
func Vote(c *gin.Context) {
	uuid := c.Param("uuid")

	poll, err := models.GetPollByUUID(uuid)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	var req VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求: "+err.Error())
		return
	}

	// 验证钉钉投票者令牌
	var dingtalkID string
	var name string
	if req.DingTalkToken != "" {
		claims, err := services.ValidateDingTalkVoterToken(req.DingTalkToken)
		if err != nil {
			utils.ResponseError(c, http.StatusUnauthorized, "钉钉身份验证失败: "+err.Error())
			return
		}
		dingtalkID = claims.DingTalkID
		name = claims.Name
	}

	// 获取客户端IP
	ipAddress := c.ClientIP()

	result, err := models.Vote(poll.ID, req.OptionIDs, dingtalkID, name, ipAddress)
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, err.Error())
		return
	}

	utils.ResponseOK(c, result)
}

// GetVoteRecords 获取投票记录
func GetVoteRecords(c *gin.Context) {
	pollID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的投票ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	records, total, err := models.GetVoteRecords(pollID, page, pageSize)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取投票记录失败")
		return
	}

	utils.ResponsePaginated(c, records, total, page, pageSize)
}

// ModifyVote 修改投票
func ModifyVote(c *gin.Context) {
	var req ModifyVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求: "+err.Error())
		return
	}

	// 验证钉钉投票者令牌
	var dingtalkID string
	var name string
	if req.DingTalkToken != "" {
		claims, err := services.ValidateDingTalkVoterToken(req.DingTalkToken)
		if err != nil {
			utils.ResponseError(c, http.StatusUnauthorized, "钉钉身份验证失败: "+err.Error())
			return
		}
		dingtalkID = claims.DingTalkID
		name = claims.Name
	}

	// 获取客户端IP
	ipAddress := c.ClientIP()

	err := models.ModifyVote(req.ModificationToken, req.OptionIDs, dingtalkID, name, ipAddress)
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, err.Error())
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "投票修改成功")
}

// CheckVoteStatus 检查用户投票状态
func CheckVoteStatus(c *gin.Context) {
	uuid := c.Param("uuid")

	poll, err := models.GetPollByUUID(uuid)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "投票不存在")
		return
	}

	// 验证钉钉投票者令牌
	var dingtalkID string
	var name string
	dingtalkToken := c.Query("dingtalk_token")
	if dingtalkToken != "" {
		claims, err := services.ValidateDingTalkVoterToken(dingtalkToken)
		if err != nil {
			// Token 无效或过期，返回 401 错误
			utils.ResponseError(c, http.StatusUnauthorized, "投票者令牌无效或已过期")
			return
		}
		dingtalkID = claims.DingTalkID
		name = claims.Name
	}

	ipAddress := c.ClientIP()

	status, err := models.CheckVoteStatus(poll, dingtalkID, name, ipAddress)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "检查投票状态失败")
		return
	}

	utils.ResponseOK(c, status)
}
