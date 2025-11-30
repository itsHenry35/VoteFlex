package utils

import "github.com/itsHenry35/VoteFlex/types"

// IsAdmin 检查用户是否是管理员
func IsAdmin(user *types.User) bool {
	return user.Role == types.RoleAdmin
}

// IsUser 检查用户是否是普通用户
func IsUser(user *types.User) bool {
	return user.Role == types.RoleUser
}
