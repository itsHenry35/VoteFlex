package types

import "time"

// IdentityType 身份验证类型
type IdentityType string

const (
	IdentityTypeNone     IdentityType = "none"     // 无限制
	IdentityTypeDingTalk IdentityType = "dingtalk" // 钉钉登录
	IdentityTypeIP       IdentityType = "ip"       // IP地址
)

// FrequencyType 频率限制类型
type FrequencyType string

const (
	FrequencyTypeTotal  FrequencyType = "total"  // 总共N次
	FrequencyTypeHourly FrequencyType = "hourly" // 每N小时N次
	FrequencyTypeDaily  FrequencyType = "daily"  // 每N天N次
)

// PollStatus 投票状态
type PollStatus string

const (
	PollStatusPending  PollStatus = "pending"  // 未开始
	PollStatusActive   PollStatus = "active"   // 进行中
	PollStatusEnded    PollStatus = "ended"    // 已结束
	PollStatusCanceled PollStatus = "canceled" // 已取消
)

// Poll 投票模型
type Poll struct {
	ID          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UUID        string `json:"uuid" gorm:"unique;not null;index"` // 唯一访问链接
	ShortCode   string `json:"short_code" gorm:"unique;index"`    // 短链接代码
	Title       string `json:"title" gorm:"not null"`
	Description string `json:"description"`

	// 身份验证限制
	IdentityType IdentityType `json:"identity_type" gorm:"not null;default:'none'"` // none/dingtalk/ip

	// 频率限制
	FrequencyType FrequencyType `json:"frequency_type" gorm:"not null;default:'total'"` // total/hourly/daily
	FrequencyN    int           `json:"frequency_n" gorm:"default:1"`                   // 每N小时/天
	FrequencyMax  int           `json:"frequency_max" gorm:"default:1"`                 // 最多投票次数

	// 投票数量限制
	MinVotes int `json:"min_votes" gorm:"default:1"` // 最少选几项
	MaxVotes int `json:"max_votes" gorm:"default:1"` // 最多选几项

	// 时间限制
	StartTime *time.Time `json:"start_time"`
	EndTime   *time.Time `json:"end_time"`

	// 结果展示
	ShowResults       bool `json:"show_results" gorm:"default:false"`       // 是否公开展示投票结果
	AllowModification bool `json:"allow_modification" gorm:"default:false"` // 是否允许修改投票

	Status    PollStatus `json:"status" gorm:"not null;default:'pending'"`
	CreatorID int        `json:"creator_id" gorm:"not null"`
	CreatedAt time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updated_at" gorm:"autoUpdateTime"`

	// 关联
	Options []Option `json:"options,omitempty" gorm:"foreignKey:PollID"`
	Creator *User    `json:"creator,omitempty" gorm:"foreignKey:CreatorID"`

	// 统计数据（非数据库字段）
	VoterCount int `json:"voter_count" gorm:"-"` // 投票人数
}

// Option 投票选项模型
type Option struct {
	ID        int       `json:"id" gorm:"primaryKey;autoIncrement"`
	PollID    int       `json:"poll_id" gorm:"not null;index"`
	Text      string    `json:"text" gorm:"not null"` // 文本内容
	ImageURL  string    `json:"image_url"`            // 图片URL（可选）
	AudioURL  string    `json:"audio_url"`            // 音频URL（可选）
	VideoURL  string    `json:"video_url"`            // 视频URL（可选）
	VoteCount int       `json:"vote_count" gorm:"default:0"`
	SortOrder int       `json:"sort_order" gorm:"default:0"` // 排序顺序
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`

	// 关联
	Poll *Poll `json:"-" gorm:"foreignKey:PollID"`
}

// VoteRecord 投票记录模型
type VoteRecord struct {
	ID         int       `json:"id" gorm:"primaryKey;autoIncrement"`
	PollID     int       `json:"poll_id" gorm:"not null;index"`
	OptionID   int       `json:"option_id" gorm:"not null;index"`
	Identifier string    `json:"identifier" gorm:"index;not null"` // 用户标识：钉钉用户为 {name}_{ding_talk_id}，IP用户为IP地址
	CreatedAt  time.Time `json:"created_at" gorm:"autoCreateTime"`

	// 关联
	Poll   *Poll   `json:"-" gorm:"foreignKey:PollID"`
	Option *Option `json:"-" gorm:"foreignKey:OptionID"`
}

// VoteModificationToken 投票修改令牌模型
type VoteModificationToken struct {
	ID           int       `json:"id" gorm:"primaryKey;autoIncrement"`
	Token        string    `json:"token" gorm:"unique;not null;index"` // 修改令牌
	PollID       int       `json:"poll_id" gorm:"not null;index"`
	Identifier   string    `json:"identifier" gorm:"index;not null"` // 用户标识：钉钉用户为 {name}_{ding_talk_id}，IP用户为IP地址
	FirstVoteIDs string    `json:"first_vote_ids" gorm:"type:text"`  // 首次投票的VoteRecord IDs（逗号分隔）
	UsedCount    int       `json:"used_count" gorm:"default:0"`      // 已使用次数
	CreatedAt    time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	// 关联
	Poll *Poll `json:"-" gorm:"foreignKey:PollID"`
}
