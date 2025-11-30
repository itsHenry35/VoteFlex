package models

import (
	"errors"
	"fmt"
	"time"

	"github.com/itsHenry35/VoteFlex/database"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
	"gorm.io/gorm"
)

// VoteStatus 投票状态信息
type VoteStatus struct {
	CanVote          bool       `json:"can_vote"`
	Message          string     `json:"message"`
	NextVoteTime     *time.Time `json:"next_vote_time"`             // 下次可投票时间
	VotedCount       int        `json:"voted_count"`                // 已投票次数（当前周期）
	RemainingVotes   int        `json:"remaining_votes"`            // 剩余可投票次数
	RequiresDingTalk bool       `json:"requires_dingtalk"`          // 是否需要钉钉登录
	CanModify        bool       `json:"can_modify"`                 // 是否可以修改投票
	ModifyToken      string     `json:"modify_token,omitempty"`     // 修改令牌（如果已投票且可修改）
	VotedOptionIDs   []int      `json:"voted_option_ids,omitempty"` // 已投票的选项ID列表
}

// VoteResult 投票结果
type VoteResult struct {
	Success           bool   `json:"success"`
	ModificationToken string `json:"modification_token,omitempty"` // 修改令牌（如果允许修改）
}

// Vote 进行投票（支持多选）
func Vote(pollID int, optionIDs []int, dingtalkID, name, ipAddress string) (*VoteResult, error) {
	db := database.GetDB()

	poll, err := GetPollByID(pollID)
	if err != nil {
		return nil, err
	}

	if poll.Status != types.PollStatusActive {
		return nil, errors.New("投票未开始或已结束")
	}

	// 检查选项数量限制
	if len(optionIDs) < poll.MinVotes {
		return nil, fmt.Errorf("至少需要选择 %d 个选项", poll.MinVotes)
	}
	if len(optionIDs) > poll.MaxVotes {
		return nil, fmt.Errorf("最多只能选择 %d 个选项", poll.MaxVotes)
	}

	// 验证所有选项是否属于该投票
	for _, optionID := range optionIDs {
		option, err := GetOptionByID(optionID)
		if err != nil {
			return nil, err
		}
		if option.PollID != pollID {
			return nil, errors.New("选项不属于该投票")
		}
	}

	// 检查投票限制
	status, err := CheckVoteStatus(poll, dingtalkID, name, ipAddress)
	if err != nil {
		return nil, err
	}
	if !status.CanVote {
		return nil, errors.New(status.Message)
	}

	result := &VoteResult{Success: true}
	var voteRecordIDs []int

	// 生成用户标识
	var identifier string
	if dingtalkID != "" && name != "" {
		// 钉钉用户：{name}_{ding_talk_id}
		identifier = fmt.Sprintf("%s_%s", name, dingtalkID)
	} else {
		// IP用户
		identifier = ipAddress
	}

	// 执行投票
	err = db.Transaction(func(tx *gorm.DB) error {
		for _, optionID := range optionIDs {
			record := &types.VoteRecord{
				PollID:     pollID,
				OptionID:   optionID,
				Identifier: identifier,
			}
			if err := tx.Create(record).Error; err != nil {
				return err
			}
			voteRecordIDs = append(voteRecordIDs, record.ID)

			if err := tx.Model(&types.Option{}).
				Where("id = ?", optionID).
				UpdateColumn("vote_count", gorm.Expr("vote_count + ?", 1)).Error; err != nil {
				return err
			}
		}

		// 如果允许修改投票，生成修改令牌
		if poll.AllowModification {
			token, err := utils.GenerateSecureToken(32)
			if err != nil {
				return err
			}

			// 将投票记录ID转换为逗号分隔的字符串
			var voteIDsStr string
			for i, id := range voteRecordIDs {
				if i > 0 {
					voteIDsStr += ","
				}
				voteIDsStr += fmt.Sprintf("%d", id)
			}

			modToken := &types.VoteModificationToken{
				Token:        token,
				PollID:       pollID,
				Identifier:   identifier,
				FirstVoteIDs: voteIDsStr,
				UsedCount:    0,
			}

			if err := tx.Create(modToken).Error; err != nil {
				return err
			}

			result.ModificationToken = token
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

// CheckVoteStatus 检查投票状态（返回详细信息）
func CheckVoteStatus(poll *types.Poll, dingtalkID, name, ipAddress string) (*VoteStatus, error) {
	db := database.GetDB()

	status := &VoteStatus{
		CanVote:          true,
		RequiresDingTalk: poll.IdentityType == types.IdentityTypeDingTalk,
		CanModify:        poll.AllowModification,
	}

	// 检查身份验证类型
	switch poll.IdentityType {
	case types.IdentityTypeDingTalk:
		if dingtalkID == "" {
			status.CanVote = false
			status.Message = "请使用钉钉登录后投票"
			return status, nil
		}
	case types.IdentityTypeIP:
		if ipAddress == "" {
			status.CanVote = false
			status.Message = "无法获取IP地址"
			return status, nil
		}
	}

	// 生成用户标识
	var identifier string
	if dingtalkID != "" && name != "" {
		// 钉钉用户：{name}_{ding_talk_id}
		identifier = fmt.Sprintf("%s_%s", name, dingtalkID)
	} else {
		// IP用户
		identifier = ipAddress
	}

	if poll.IdentityType == types.IdentityTypeNone {
		status.RemainingVotes = poll.FrequencyMax
		return status, nil
	}

	// 计算投票次数
	var count int64
	var lastVoteTime time.Time
	now := time.Now()

	switch poll.FrequencyType {
	case types.FrequencyTypeTotal:
		// 总共N次
		db.Model(&types.VoteRecord{}).
			Where("poll_id = ? AND identifier = ?", poll.ID, identifier).
			Count(&count)
		status.VotedCount = int(count)
		status.RemainingVotes = poll.FrequencyMax - int(count)
		if count >= int64(poll.FrequencyMax) {
			status.CanVote = false
			status.Message = "您已达到最大投票次数"
		}

	case types.FrequencyTypeHourly:
		// 每N小时N次
		periodStart := now.Add(-time.Duration(poll.FrequencyN) * time.Hour)
		db.Model(&types.VoteRecord{}).
			Where("poll_id = ? AND identifier = ? AND created_at >= ?", poll.ID, identifier, periodStart).
			Count(&count)
		var record types.VoteRecord
		db.Where("poll_id = ? AND identifier = ?", poll.ID, identifier).
			Order("created_at DESC").First(&record)
		if record.ID > 0 {
			lastVoteTime = record.CreatedAt
		}
		status.VotedCount = int(count)
		status.RemainingVotes = poll.FrequencyMax - int(count)
		if count >= int64(poll.FrequencyMax) {
			status.CanVote = false
			nextTime := lastVoteTime.Add(time.Duration(poll.FrequencyN) * time.Hour)
			status.NextVoteTime = &nextTime
			status.Message = fmt.Sprintf("您在 %d 小时内已投票 %d 次，下次可投票时间：%s",
				poll.FrequencyN, count, nextTime.Format("2006-01-02 15:04"))
		}

	case types.FrequencyTypeDaily:
		// 每N天N次
		periodStart := now.Add(-time.Duration(poll.FrequencyN) * 24 * time.Hour)
		db.Model(&types.VoteRecord{}).
			Where("poll_id = ? AND identifier = ? AND created_at >= ?", poll.ID, identifier, periodStart).
			Count(&count)
		var record types.VoteRecord
		db.Where("poll_id = ? AND identifier = ?", poll.ID, identifier).
			Order("created_at DESC").First(&record)
		if record.ID > 0 {
			lastVoteTime = record.CreatedAt
		}
		status.VotedCount = int(count)
		status.RemainingVotes = poll.FrequencyMax - int(count)
		if count >= int64(poll.FrequencyMax) {
			status.CanVote = false
			nextTime := lastVoteTime.Add(time.Duration(poll.FrequencyN) * 24 * time.Hour)
			status.NextVoteTime = &nextTime
			status.Message = fmt.Sprintf("您在 %d 天内已投票 %d 次，下次可投票时间：%s",
				poll.FrequencyN, count, nextTime.Format("2006-01-02 15:04"))
		}
	}

	// 如果投票允许修改，且用户已投票，查询修改令牌和已投票的选项
	if poll.AllowModification && identifier != "" {
		var token types.VoteModificationToken
		if err := db.Where("poll_id = ? AND identifier = ?", poll.ID, identifier).
			Order("created_at DESC").
			First(&token).Error; err == nil {
			// 找到了修改令牌，返回给前端
			status.ModifyToken = token.Token

			// 查询用户已投票的选项ID列表
			var voteRecords []types.VoteRecord
			if err := db.Where("poll_id = ? AND identifier = ?", poll.ID, identifier).
				Find(&voteRecords).Error; err == nil {
				votedOptionIDs := make([]int, 0, len(voteRecords))
				for _, record := range voteRecords {
					votedOptionIDs = append(votedOptionIDs, record.OptionID)
				}
				status.VotedOptionIDs = votedOptionIDs
			}
		}
	}

	return status, nil
}

// ModifyVote 修改投票
func ModifyVote(modificationToken string, newOptionIDs []int, dingtalkID, name, ipAddress string) error {
	db := database.GetDB()

	// 查找修改令牌
	var token types.VoteModificationToken
	if err := db.Where("token = ?", modificationToken).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("无效的修改令牌")
		}
		return err
	}

	// 获取投票信息
	poll, err := GetPollByID(token.PollID)
	if err != nil {
		return err
	}

	// 检查投票是否允许修改
	if !poll.AllowModification {
		return errors.New("该投票不允许修改")
	}

	// 检查投票状态
	if poll.Status != types.PollStatusActive {
		return errors.New("投票未开始或已结束，无法修改")
	}

	// 生成当前用户标识
	var currentIdentifier string
	if dingtalkID != "" && name != "" {
		currentIdentifier = fmt.Sprintf("%s_%s", name, dingtalkID)
	} else {
		currentIdentifier = ipAddress
	}

	// 验证身份
	if token.Identifier != currentIdentifier {
		return errors.New("身份验证失败：令牌与当前用户不匹配")
	}

	// 检查新选项数量限制
	if len(newOptionIDs) < poll.MinVotes {
		return fmt.Errorf("至少需要选择 %d 个选项", poll.MinVotes)
	}
	if len(newOptionIDs) > poll.MaxVotes {
		return fmt.Errorf("最多只能选择 %d 个选项", poll.MaxVotes)
	}

	// 验证所有选项是否属于该投票
	for _, optionID := range newOptionIDs {
		option, err := GetOptionByID(optionID)
		if err != nil {
			return err
		}
		if option.PollID != poll.ID {
			return errors.New("选项不属于该投票")
		}
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// 解析原始投票记录IDs
		var oldVoteRecordIDs []int
		if token.FirstVoteIDs != "" {
			voteIDsStr := token.FirstVoteIDs
			var currentID string
			for _, ch := range voteIDsStr + "," {
				if ch == ',' {
					if currentID != "" {
						var id int
						if _, err := fmt.Sscanf(currentID, "%d", &id); err == nil {
							oldVoteRecordIDs = append(oldVoteRecordIDs, id)
						}
						currentID = ""
					}
				} else {
					currentID += string(ch)
				}
			}
		}

		// 获取旧的投票记录并减少相应选项的票数
		for _, recordID := range oldVoteRecordIDs {
			var oldRecord types.VoteRecord
			if err := tx.First(&oldRecord, recordID).Error; err != nil {
				continue // 记录可能已被删除，跳过
			}

			// 减少旧选项的票数
			if err := tx.Model(&types.Option{}).
				Where("id = ?", oldRecord.OptionID).
				UpdateColumn("vote_count", gorm.Expr("vote_count - ?", 1)).Error; err != nil {
				return err
			}

			// 删除旧的投票记录
			if err := tx.Delete(&oldRecord).Error; err != nil {
				return err
			}
		}

		// 创建新的投票记录
		var newVoteRecordIDs []int
		for _, optionID := range newOptionIDs {
			record := &types.VoteRecord{
				PollID:     poll.ID,
				OptionID:   optionID,
				Identifier: currentIdentifier,
			}
			if err := tx.Create(record).Error; err != nil {
				return err
			}
			newVoteRecordIDs = append(newVoteRecordIDs, record.ID)

			// 增加新选项的票数
			if err := tx.Model(&types.Option{}).
				Where("id = ?", optionID).
				UpdateColumn("vote_count", gorm.Expr("vote_count + ?", 1)).Error; err != nil {
				return err
			}
		}

		// 更新修改令牌，保存新的投票记录IDs
		var newVoteIDsStr string
		for i, id := range newVoteRecordIDs {
			if i > 0 {
				newVoteIDsStr += ","
			}
			newVoteIDsStr += fmt.Sprintf("%d", id)
		}

		if err := tx.Model(&token).Updates(map[string]interface{}{
			"first_vote_ids": newVoteIDsStr,
			"used_count":     token.UsedCount + 1,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetVoteRecords 获取投票记录
func GetVoteRecords(pollID int, page, pageSize int) ([]*types.VoteRecord, int, error) {
	db := database.GetDB()

	var total int64
	if err := db.Model(&types.VoteRecord{}).Where("poll_id = ?", pollID).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := db.Where("poll_id = ?", pollID).Order("id DESC")

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Limit(pageSize).Offset(offset)
	}

	var records []*types.VoteRecord
	if err := query.Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, int(total), nil
}
