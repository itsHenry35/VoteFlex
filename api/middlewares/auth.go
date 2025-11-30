package middlewares

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/models"
	"github.com/itsHenry35/VoteFlex/services"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
)

// 上下文键
const (
	UserIDKey   string = "user_id"
	UsernameKey string = "username"
	RoleKey     string = "role"
)

// AuthMiddleware 身份验证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.ResponseError(c, http.StatusUnauthorized, "authorization header is required")
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.ResponseError(c, http.StatusUnauthorized, "无效的授权格式")
			c.Abort()
			return
		}
		tokenString := parts[1]

		claims, err := services.ValidateToken(tokenString)
		if err != nil {
			utils.ResponseError(c, http.StatusUnauthorized, "无效的令牌")
			c.Abort()
			return
		}

		_, err = models.GetUserByID(claims.UserID)
		if err != nil {
			utils.ResponseError(c, http.StatusUnauthorized, "user not found")
			c.Abort()
			return
		}

		c.Set(UserIDKey, claims.UserID)
		c.Set(UsernameKey, claims.Username)
		c.Set(RoleKey, claims.Role)

		c.Next()
	}
}

// AdminMiddleware 管理员验证中间件
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := GetRoleFromContext(c)
		if !ok || role != types.RoleAdmin {
			utils.ResponseError(c, http.StatusForbidden, "admin access required")
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserIDFromContext 从上下文获取用户ID
func GetUserIDFromContext(c *gin.Context) (int, bool) {
	userID, ok := c.Get(UserIDKey)
	if !ok {
		return 0, false
	}
	id, ok := userID.(int)
	return id, ok
}

// GetRoleFromContext 从上下文获取用户角色
func GetRoleFromContext(c *gin.Context) (types.UserRole, bool) {
	role, ok := c.Get(RoleKey)
	if !ok {
		return "", false
	}
	r, ok := role.(types.UserRole)
	return r, ok
}

// IsAdmin 判断用户是否为管理员
func IsAdmin(c *gin.Context) bool {
	role, ok := GetRoleFromContext(c)
	return ok && role == types.RoleAdmin
}
