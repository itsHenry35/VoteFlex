package models

import (
	"errors"

	"github.com/itsHenry35/VoteFlex/database"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// IsAdmin 检查用户是否是管理员
func IsAdmin(user *types.User) bool {
	return utils.IsAdmin(user)
}

// CreateUser 创建新用户
func CreateUser(username, password, fullName string, role types.UserRole, dingtalkId string) (*types.User, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	db := database.GetDB()

	user := &types.User{
		Username:   username,
		Password:   string(hashedPassword),
		FullName:   fullName,
		Role:       role,
		DingTalkID: dingtalkId,
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return user, nil
}

// GetUserByID 通过 ID 获取用户
func GetUserByID(id int) (*types.User, error) {
	db := database.GetDB()

	var user types.User
	err := db.First(&user, id).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}

	return &user, nil
}

// GetUserByUsername 通过用户名获取用户
func GetUserByUsername(username string) (*types.User, error) {
	db := database.GetDB()

	var user types.User
	err := db.Where("username = ?", username).First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}

	return &user, nil
}

// GetUserByDingTalkID 通过钉钉ID获取用户
func GetUserByDingTalkID(dingTalkID string) (*types.User, error) {
	db := database.GetDB()

	var user types.User
	err := db.Where("ding_talk_id = ?", dingTalkID).First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}

	return &user, nil
}

// CreateUserByDingTalk 通过钉钉信息自动创建用户
func CreateUserByDingTalk(dingtalkID, name string) (*types.User, error) {
	// 使用钉钉ID作为用户名
	username := dingtalkID

	// 生成随机密码
	password, err := utils.GenerateRandomPassword(16)
	if err != nil {
		return nil, err
	}

	return CreateUser(username, password, name, types.RoleUser, dingtalkID)
}

// UpdateUser 更新用户信息
func UpdateUser(user *types.User) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Select("full_name", "role", "ding_talk_id").Where("id = ?", user.ID).Updates(user).Error; err != nil {
			return err
		}
		return nil
	})
}

// UpdatePassword 更新用户密码
func UpdatePassword(userID int, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	db := database.GetDB()

	return db.Model(&types.User{}).Where("id = ?", userID).Update("password", string(hashedPassword)).Error
}

// DeleteUser 删除用户
func DeleteUser(id int) error {
	db := database.GetDB()

	return db.Transaction(func(tx *gorm.DB) error {
		return tx.Delete(&types.User{}, id).Error
	})
}

// VerifyPassword 验证用户密码
func VerifyPassword(username, password string) (*types.User, error) {
	user, err := GetUserByUsername(username)
	if err != nil {
		return nil, errors.New("账号或密码错误")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, errors.New("账号或密码错误")
	}

	return user, nil
}

// GetAllUsers 获取所有用户，支持分页
func GetAllUsers(page, pageSize int) ([]*types.User, int, error) {
	db := database.GetDB()

	var total int64
	if err := db.Model(&types.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	query := db.Order("id")

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Limit(pageSize).Offset(offset)
	}

	var users []*types.User
	if err := query.Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, int(total), nil
}
