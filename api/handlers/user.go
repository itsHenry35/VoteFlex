package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/models"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
)

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Username   string `json:"username" binding:"required"`
	Password   string `json:"password" binding:"required"`
	FullName   string `json:"full_name" binding:"required"`
	Role       string `json:"role" binding:"required"` // admin 或 user
	DingTalkID string `json:"ding_talk_id"`
}

// UpdateUserRequest 更新用户请求
type UpdateUserRequest struct {
	FullName   string `json:"full_name"`
	Role       string `json:"role"`
	DingTalkID string `json:"ding_talk_id"`
	Password   string `json:"password"` // 可选，如果提供则更新密码
}

// UpdatePasswordRequest 更新密码请求
type UpdatePasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

// GetAllUsers 获取所有用户
func GetAllUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	users, total, err := models.GetAllUsers(page, pageSize)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "获取用户列表失败")
		return
	}

	utils.ResponsePaginated(c, users, total, page, pageSize)
}

// GetUser 获取用户详情
func GetUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的用户ID")
		return
	}

	user, err := models.GetUserByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "用户不存在")
		return
	}

	utils.ResponseOK(c, user)
}

// CreateUser 创建用户
func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	// 验证角色
	role := types.UserRole(req.Role)
	if role != types.RoleAdmin && role != types.RoleUser {
		utils.ResponseError(c, http.StatusBadRequest, "无效的用户角色")
		return
	}

	user, err := models.CreateUser(req.Username, req.Password, req.FullName, role, req.DingTalkID)
	if err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "创建用户失败: "+err.Error())
		return
	}

	utils.ResponseOK(c, user)
}

// UpdateUser 更新用户
func UpdateUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的用户ID")
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	user, err := models.GetUserByID(id)
	if err != nil {
		utils.ResponseError(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 直接更新字段
	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.Role != "" {
		role := types.UserRole(req.Role)
		if role != types.RoleAdmin && role != types.RoleUser {
			utils.ResponseError(c, http.StatusBadRequest, "无效的用户角色")
			return
		}
		user.Role = role
	}
	// 直接赋值，允许清空钉钉ID
	user.DingTalkID = req.DingTalkID

	// 如果提供了密码，则更新密码
	if req.Password != "" {
		if err := models.UpdatePassword(user.ID, req.Password); err != nil {
			utils.ResponseError(c, http.StatusInternalServerError, "更新密码失败")
			return
		}
	}

	if err := models.UpdateUser(user); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "更新用户失败")
		return
	}

	utils.ResponseOK(c, user)
}

// DeleteUser 删除用户
func DeleteUser(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的用户ID")
		return
	}

	if err := models.DeleteUser(id); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "删除用户失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "删除成功")
}

// UpdatePassword 更新密码
func UpdatePassword(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效的用户ID")
		return
	}

	var req UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	if err := models.UpdatePassword(id, req.Password); err != nil {
		utils.ResponseError(c, http.StatusInternalServerError, "更新密码失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "密码更新成功")
}
