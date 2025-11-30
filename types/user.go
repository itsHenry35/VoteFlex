package types

// UserRole 用户角色
type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleUser  UserRole = "user"
)

// User 用户模型
type User struct {
	ID         int      `json:"id" gorm:"primaryKey;autoIncrement"`
	Username   string   `json:"username" gorm:"unique;not null"`
	Password   string   `json:"-" gorm:"not null"` // 不暴露密码
	FullName   string   `json:"full_name" gorm:"not null"`
	Role       UserRole `json:"role" gorm:"not null;default:'user'"` // admin 或 user
	DingTalkID string   `json:"ding_talk_id" gorm:"default:''"`
}
