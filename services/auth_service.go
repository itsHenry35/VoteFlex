package services

import (
	"errors"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/itsHenry35/VoteFlex/config"
	"github.com/itsHenry35/VoteFlex/models"
	"github.com/itsHenry35/VoteFlex/types"
	"github.com/itsHenry35/VoteFlex/utils"
)

// JWTClaims JWT 的自定义声明（用于用户登录）
type JWTClaims struct {
	UserID   int            `json:"user_id"`
	Username string         `json:"username"`
	Role     types.UserRole `json:"role"`
	jwt.StandardClaims
}

// DingTalkVoterClaims 钉钉投票者身份声明（用于投票验证）
type DingTalkVoterClaims struct {
	DingTalkID string `json:"ding_talk_id"`
	Name       string `json:"name"`
	jwt.StandardClaims
}

// GenerateToken 生成 JWT 令牌
func GenerateToken(id int, username string, role types.UserRole) (string, error) {
	cfg := config.Get()
	jwtSecret := []byte(cfg.Security.JWTSecret)

	// 设置 token 有效期为 30 天
	expirationTime := time.Now().Add(30 * 24 * time.Hour)

	claims := &JWTClaims{
		UserID:   id,
		Username: username,
		Role:     role,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateDingTalkVoterToken 生成钉钉投票者身份令牌
func GenerateDingTalkVoterToken(dingtalkID, name string) (string, error) {
	cfg := config.Get()
	jwtSecret := []byte(cfg.Security.JWTSecret)

	// 设置 token 有效期为 24 小时
	expirationTime := time.Now().Add(24 * time.Hour)

	claims := &DingTalkVoterClaims{
		DingTalkID: dingtalkID,
		Name:       name,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// ValidateToken 验证 JWT 令牌
func ValidateToken(tokenString string) (*JWTClaims, error) {
	cfg := config.Get()
	jwtSecret := []byte(cfg.Security.JWTSecret)

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效的令牌")
}

// ValidateDingTalkVoterToken 验证钉钉投票者身份令牌
func ValidateDingTalkVoterToken(tokenString string) (*DingTalkVoterClaims, error) {
	cfg := config.Get()
	jwtSecret := []byte(cfg.Security.JWTSecret)

	token, err := jwt.ParseWithClaims(tokenString, &DingTalkVoterClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*DingTalkVoterClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效的投票者令牌")
}

// Login 用户登录
func Login(username, password string) (string, *types.User, error) {
	user, err := models.VerifyPassword(username, password)
	if err != nil {
		return "", nil, err
	}

	token, err := GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// DingTalkLogin 钉钉免登录
func DingTalkLogin(code string) (string, interface{}, error) {
	userInfo, err := utils.GetDingTalkUserInfo(code)
	if err != nil {
		return "", nil, err
	}

	if userInfo.UserID == "0" || userInfo.UserID == "" {
		return "", nil, errors.New("获取用户信息失败")
	}

	// 尝试查找已注册用户
	user, err := models.GetUserByDingTalkID(userInfo.UserID)
	if err == nil {
		token, err := GenerateToken(user.ID, user.Username, user.Role)
		if err != nil {
			return "", nil, err
		}
		return token, user, nil
	}

	// 检查是否启用自助注册
	cfg := config.Get()
	if cfg.DingTalk.SelfRegister {
		// 自动创建用户
		newUser, err := models.CreateUserByDingTalk(userInfo.UserID, userInfo.Name)
		if err != nil {
			return "", nil, errors.New("自动注册失败: " + err.Error())
		}

		token, err := GenerateToken(newUser.ID, newUser.Username, newUser.Role)
		if err != nil {
			return "", nil, err
		}
		return token, newUser, nil
	}

	// 对于未注册用户且未启用自助注册，生成投票者令牌
	voterToken, err := GenerateDingTalkVoterToken(userInfo.UserID, userInfo.Name)
	if err != nil {
		return "", nil, err
	}

	return "", map[string]interface{}{
		"dingtalk_token": voterToken,
		"name":           userInfo.Name,
		"is_user":        false,
	}, nil
}

// GetDingTalkUserID 通过钉钉授权码获取用户ID并返回签名token
func GetDingTalkUserID(code string) (string, string, string, error) {
	userInfo, err := utils.GetDingTalkUserInfo(code)
	if err != nil {
		return "", "", "", err
	}

	if userInfo.UserID == "0" || userInfo.UserID == "" {
		return "", "", "", errors.New("获取用户信息失败")
	}

	// 生成投票者令牌
	voterToken, err := GenerateDingTalkVoterToken(userInfo.UserID, userInfo.Name)
	if err != nil {
		return "", "", "", err
	}

	return userInfo.UserID, userInfo.Name, voterToken, nil
}

// DingTalkSSOLogin 钉钉SSO登录（用于非钉钉客户端环境）
func DingTalkSSOLogin(userID, name string) (string, string, interface{}, error) {
	if userID == "" {
		return "", "", nil, errors.New("用户ID为空")
	}

	// 尝试查找已注册用户
	user, err := models.GetUserByDingTalkID(userID)
	if err == nil {
		token, err := GenerateToken(user.ID, user.Username, user.Role)
		if err != nil {
			return "", "", nil, err
		}
		return token, "", user, nil
	}

	// 检查是否启用自助注册
	cfg := config.Get()
	if cfg.DingTalk.SelfRegister {
		// 自动创建用户
		newUser, err := models.CreateUserByDingTalk(userID, name)
		if err != nil {
			return "", "", nil, errors.New("自动注册失败: " + err.Error())
		}

		token, err := GenerateToken(newUser.ID, newUser.Username, newUser.Role)
		if err != nil {
			return "", "", nil, err
		}
		return token, "", newUser, nil
	}

	// 对于未注册用户且未启用自助注册，生成投票者令牌
	voterToken, err := GenerateDingTalkVoterToken(userID, name)
	if err != nil {
		return "", "", nil, err
	}

	return "", voterToken, map[string]interface{}{
		"name":    name,
		"is_user": false,
	}, nil
}
