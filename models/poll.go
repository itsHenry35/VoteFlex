package models

import (
	"errors"
	"time"

	"github.com/itsHenry35/VoteFlex/database"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
	"gorm.io/gorm"
)

// OptionInput 创建选项的输入结构
type OptionInput struct {
	Text     string `json:"text"`
	ImageURL string `json:"image_url"`
	AudioURL string `json:"audio_url"`
	VideoURL string `json:"video_url"`
}

// CreatePoll 创建投票
func CreatePoll(title, description string, identityType types.IdentityType, frequencyType types.FrequencyType, frequencyN, frequencyMax, minVotes, maxVotes int, startTime, endTime *time.Time, showResults, allowModification bool, creatorID int, options []OptionInput) (*types.Poll, error) {
	db := database.GetDB()

	status := types.PollStatusPending
	now := time.Now()
	if startTime == nil || now.After(*startTime) {
		status = types.PollStatusActive
	}
	if endTime != nil && now.After(*endTime) {
		status = types.PollStatusEnded
	}

	// 生成UUID和短链接代码
	uuid := utils.GenerateUUID()
	shortCode := utils.GenerateShortCode()

	poll := &types.Poll{
		UUID:              uuid,
		ShortCode:         shortCode,
		Title:             title,
		Description:       description,
		IdentityType:      identityType,
		FrequencyType:     frequencyType,
		FrequencyN:        frequencyN,
		FrequencyMax:      frequencyMax,
		MinVotes:          minVotes,
		MaxVotes:          maxVotes,
		StartTime:         startTime,
		EndTime:           endTime,
		ShowResults:       showResults,
		AllowModification: allowModification,
		Status:            status,
		CreatorID:         creatorID,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(poll).Error; err != nil {
			return err
		}

		for i, opt := range options {
			option := &types.Option{
				PollID:    poll.ID,
				Text:      opt.Text,
				ImageURL:  opt.ImageURL,
				AudioURL:  opt.AudioURL,
				VideoURL:  opt.VideoURL,
				SortOrder: i,
			}
			if err := tx.Create(option).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return GetPollByID(poll.ID)
}

// GetPollByID 通过 ID 获取投票
func GetPollByID(id int) (*types.Poll, error) {
	db := database.GetDB()

	var poll types.Poll
	err := db.Preload("Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Preload("Creator").First(&poll, id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("投票不存在")
		}
		return nil, err
	}

	updatePollStatus(&poll)

	return &poll, nil
}

// GetPollByUUID 通过 UUID 获取投票
func GetPollByUUID(uuid string) (*types.Poll, error) {
	db := database.GetDB()

	var poll types.Poll
	err := db.Preload("Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Preload("Creator").Where("uuid = ?", uuid).First(&poll).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("投票不存在")
		}
		return nil, err
	}

	updatePollStatus(&poll)

	return &poll, nil
}

// GetPollByShortCode 通过短链接代码获取投票
func GetPollByShortCode(shortCode string) (*types.Poll, error) {
	db := database.GetDB()

	var poll types.Poll
	err := db.Preload("Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Preload("Creator").Where("short_code = ?", shortCode).First(&poll).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("投票不存在")
		}
		return nil, err
	}

	updatePollStatus(&poll)

	return &poll, nil
}

// GetPollsByCreatorID 获取用户创建的投票
func GetPollsByCreatorID(creatorID int, page, pageSize int) ([]*types.Poll, int, error) {
	db := database.GetDB()

	var total int64
	if err := db.Model(&types.Poll{}).Where("creator_id = ?", creatorID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := db.Preload("Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("creator_id = ?", creatorID).Order("id DESC")

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Limit(pageSize).Offset(offset)
	}

	var polls []*types.Poll
	if err := query.Find(&polls).Error; err != nil {
		return nil, 0, err
	}

	for _, poll := range polls {
		updatePollStatus(poll)
		// 计算投票人数
		poll.VoterCount = getVoterCount(poll.ID)
	}

	return polls, int(total), nil
}

// GetAllPolls 获取所有投票（仅管理员使用），支持分页
func GetAllPolls(page, pageSize int) ([]*types.Poll, int, error) {
	db := database.GetDB()

	var total int64
	if err := db.Model(&types.Poll{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := db.Preload("Options", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Preload("Creator").Order("id DESC")

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Limit(pageSize).Offset(offset)
	}

	var polls []*types.Poll
	if err := query.Find(&polls).Error; err != nil {
		return nil, 0, err
	}

	for _, poll := range polls {
		updatePollStatus(poll)
		// 计算投票人数
		poll.VoterCount = getVoterCount(poll.ID)
	}

	return polls, int(total), nil
}

// UpdatePoll 更新投票
func UpdatePoll(poll *types.Poll) error {
	db := database.GetDB()
	return db.Save(poll).Error
}

// UpdatePollOptions 更新投票的所有选项
func UpdatePollOptions(pollID int, options []OptionInput) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		// 删除旧的选项
		if err := tx.Where("poll_id = ?", pollID).Delete(&types.Option{}).Error; err != nil {
			return err
		}

		// 创建新的选项
		for i, opt := range options {
			option := &types.Option{
				PollID:    pollID,
				Text:      opt.Text,
				ImageURL:  opt.ImageURL,
				AudioURL:  opt.AudioURL,
				VideoURL:  opt.VideoURL,
				SortOrder: i,
			}
			if err := tx.Create(option).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// DeletePoll 删除投票
func DeletePoll(id int) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("poll_id = ?", id).Delete(&types.VoteRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Where("poll_id = ?", id).Delete(&types.Option{}).Error; err != nil {
			return err
		}
		return tx.Delete(&types.Poll{}, id).Error
	})
}

// EndPoll 提前结束投票
func EndPoll(id int) error {
	db := database.GetDB()
	return db.Model(&types.Poll{}).Where("id = ?", id).Update("status", types.PollStatusEnded).Error
}

// ReopenPoll 重新开启投票（清除结束时间以避免自动结束）
func ReopenPoll(id int) error {
	db := database.GetDB()
	return db.Model(&types.Poll{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":   types.PollStatusActive,
		"end_time": nil,
	}).Error
}

// AddOption 添加选项
func AddOption(pollID int, text, imageURL, audioURL, videoURL string) (*types.Option, error) {
	db := database.GetDB()

	// 获取当前最大的 sort_order
	var maxOrder int
	db.Model(&types.Option{}).Where("poll_id = ?", pollID).Select("COALESCE(MAX(sort_order), -1)").Scan(&maxOrder)

	option := &types.Option{
		PollID:    pollID,
		Text:      text,
		ImageURL:  imageURL,
		AudioURL:  audioURL,
		VideoURL:  videoURL,
		SortOrder: maxOrder + 1,
		VoteCount: 0,
	}

	if err := db.Create(option).Error; err != nil {
		return nil, err
	}

	return option, nil
}

// DeleteOption 删除选项
func DeleteOption(optionID int) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		// 获取该选项的信息
		var option types.Option
		if err := tx.First(&option, optionID).Error; err != nil {
			return err
		}

		// 删除选项
		if err := tx.Delete(&types.Option{}, optionID).Error; err != nil {
			return err
		}

		// 更新后续选项的 sort_order（减1）
		if err := tx.Model(&types.Option{}).
			Where("poll_id = ? AND sort_order > ?", option.PollID, option.SortOrder).
			UpdateColumn("sort_order", gorm.Expr("sort_order - 1")).Error; err != nil {
			return err
		}

		return nil
	})
}

// UpdateOption 更新选项
func UpdateOption(optionID int, text, imageURL, audioURL, videoURL string) (*types.Option, error) {
	db := database.GetDB()

	var option types.Option
	if err := db.First(&option, optionID).Error; err != nil {
		return nil, err
	}

	option.Text = text
	option.ImageURL = imageURL
	option.AudioURL = audioURL
	option.VideoURL = videoURL

	if err := db.Save(&option).Error; err != nil {
		return nil, err
	}

	return &option, nil
}

// UpdateOptionOrder 更新选项顺序
func UpdateOptionOrder(pollID, optionID, newOrder int) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		// 获取当前选项信息
		var option types.Option
		if err := tx.First(&option, optionID).Error; err != nil {
			return err
		}

		// 确保选项属于指定的投票
		if option.PollID != pollID {
			return gorm.ErrRecordNotFound
		}

		oldOrder := option.SortOrder

		// 如果顺序没有变化，直接返回
		if oldOrder == newOrder {
			return nil
		}

		// 获取该投票的所有选项数量
		var count int64
		tx.Model(&types.Option{}).Where("poll_id = ?", pollID).Count(&count)

		// 确保新顺序在有效范围内
		if newOrder < 0 || newOrder >= int(count) {
			return gorm.ErrInvalidData
		}

		if newOrder > oldOrder {
			// 向后移动：将中间的选项向前移动
			if err := tx.Model(&types.Option{}).
				Where("poll_id = ? AND sort_order > ? AND sort_order <= ?", pollID, oldOrder, newOrder).
				UpdateColumn("sort_order", gorm.Expr("sort_order - 1")).Error; err != nil {
				return err
			}
		} else {
			// 向前移动：将中间的选项向后移动
			if err := tx.Model(&types.Option{}).
				Where("poll_id = ? AND sort_order >= ? AND sort_order < ?", pollID, newOrder, oldOrder).
				UpdateColumn("sort_order", gorm.Expr("sort_order + 1")).Error; err != nil {
				return err
			}
		}

		// 更新目标选项的顺序
		if err := tx.Model(&option).Update("sort_order", newOrder).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetOptionByID 通过 ID 获取选项
func GetOptionByID(id int) (*types.Option, error) {
	db := database.GetDB()

	var option types.Option
	err := db.First(&option, id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("选项不存在")
		}
		return nil, err
	}

	return &option, nil
}

// GetOptionsByPollID 获取投票的所有选项（按票数排序）
func GetOptionsByPollID(pollID int) ([]types.Option, error) {
	db := database.GetDB()

	var options []types.Option
	err := db.Where("poll_id = ?", pollID).Order("vote_count DESC, sort_order ASC").Find(&options).Error
	if err != nil {
		return nil, err
	}

	return options, nil
}

// updatePollStatus 根据时间自动更新投票状态
func updatePollStatus(poll *types.Poll) {
	if poll.Status == types.PollStatusCanceled || poll.Status == types.PollStatusEnded {
		return
	}

	now := time.Now()

	if poll.StartTime != nil && now.Before(*poll.StartTime) {
		poll.Status = types.PollStatusPending
	} else if poll.EndTime != nil && now.After(*poll.EndTime) {
		poll.Status = types.PollStatusEnded
	} else if poll.StartTime == nil || now.After(*poll.StartTime) {
		poll.Status = types.PollStatusActive
	}

	database.GetDB().Model(poll).Update("status", poll.Status)
}

// getVoterCount 获取投票的投票人数（去重）
func getVoterCount(pollID int) int {
	db := database.GetDB()

	// 根据投票记录，按 ding_talk_id 和 ip_address 去重统计投票人数
	// 如果有 ding_talk_id，则按 ding_talk_id 统计
	// 如果没有 ding_talk_id，则按 ip_address 统计
	var count int64

	// 使用子查询去重：先按照 ding_talk_id（非空）或 ip_address 分组
	db.Raw(`
		SELECT COUNT(DISTINCT
			CASE
				WHEN ding_talk_id != '' THEN ding_talk_id
				ELSE ip_address
			END
		)
		FROM vote_records
		WHERE poll_id = ?
	`, pollID).Scan(&count)

	return int(count)
}

// CheckShortCodeExists 检查短链接是否已被使用
func CheckShortCodeExists(shortCode string, excludePollID int) error {
	db := database.GetDB()

	var count int64
	err := db.Model(&types.Poll{}).
		Where("short_code = ? AND id != ?", shortCode, excludePollID).
		Count(&count).Error

	if err != nil {
		return err
	}

	if count > 0 {
		return errors.New("短链接已存在")
	}

	return nil
}

// SetPollShortCode 设置投票的短链接
func SetPollShortCode(pollID int, shortCode string) error {
	db := database.GetDB()
	return db.Model(&types.Poll{}).Where("id = ?", pollID).Update("short_code", shortCode).Error
}
