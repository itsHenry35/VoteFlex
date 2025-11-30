package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/config"
	"github.com/itsHenry35/VoteFlex/services"
	"github.com/itsHenry35/VoteFlex/utils"
)

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string `json:"token"`
	User  struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
		FullName string `json:"full_name"`
		Role     string `json:"role"`
	} `json:"user"`
}

// DingTalkLoginRequest 钉钉登录请求
type DingTalkLoginRequest struct {
	Code string `json:"code"`
}

// Login 用户登录
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	token, user, err := services.Login(req.Username, req.Password)
	if err != nil {
		utils.ResponseError(c, http.StatusUnauthorized, err.Error())
		return
	}

	resp := LoginResponse{
		Token: token,
		User: struct {
			ID       int    `json:"id"`
			Username string `json:"username"`
			FullName string `json:"full_name"`
			Role     string `json:"role"`
		}{
			ID:       user.ID,
			Username: user.Username,
			FullName: user.FullName,
			Role:     string(user.Role),
		},
	}

	utils.ResponseOK(c, resp)
}

// DingTalkLogin 钉钉登录
func DingTalkLogin(c *gin.Context) {
	var req DingTalkLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	token, userObj, err := services.DingTalkLogin(req.Code)
	if err != nil {
		utils.ResponseError(c, http.StatusUnauthorized, err.Error())
		return
	}

	utils.ResponseOK(c, map[string]interface{}{
		"token": token,
		"user":  userObj,
	})
}

// DingTalkGetUserID 获取钉钉用户ID（用于投票）
func DingTalkGetUserID(c *gin.Context) {
	var req DingTalkLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, http.StatusBadRequest, "无效请求")
		return
	}

	_, name, voterToken, err := services.GetDingTalkUserID(req.Code)
	if err != nil {
		utils.ResponseError(c, http.StatusUnauthorized, err.Error())
		return
	}

	utils.ResponseOK(c, map[string]interface{}{
		"dingtalk_token": voterToken,
		"name":           name,
	})
}

// DingTalkSSORedirect 钉钉SSO登录重定向
// 用于非钉钉客户端环境下的登录
func DingTalkSSORedirect(c *gin.Context) {
	cfg := config.Get()
	clientID := cfg.DingTalk.AppKey // AppKey 即为 ClientID

	if clientID == "" {
		utils.ResponseError(c, http.StatusBadRequest, "钉钉SSO未配置")
		return
	}

	// 获取回调地址
	method := c.Query("method") // get_vote_token 或 sso_get_token
	if method == "" {
		method = "get_vote_token"
	}

	// 获取最终重定向路径（SSO完成后跳转回的页面）
	redirectPath := c.Query("redirect")
	if redirectPath == "" {
		redirectPath = "/"
	}

	// 构建回调URL
	scheme := "https"
	if c.Request.TLS == nil {
		// 检查X-Forwarded-Proto头
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		} else {
			scheme = "http"
		}
	}
	redirectURI := fmt.Sprintf("%s://%s/api/public/dingtalk/sso_callback?method=%s&redirect=%s",
		scheme, c.Request.Host, method, url.QueryEscape(redirectPath))

	// 构建钉钉OAuth2授权URL
	urlValues := url.Values{}
	urlValues.Add("response_type", "code")
	urlValues.Add("client_id", clientID)
	urlValues.Add("redirect_uri", redirectURI)
	urlValues.Add("scope", "openid")
	urlValues.Add("prompt", "consent")

	authURL := "https://login.dingtalk.com/oauth2/auth?" + urlValues.Encode()
	c.Redirect(http.StatusFound, authURL)
}

// DingTalkSSOCallback 钉钉SSO登录回调
func DingTalkSSOCallback(c *gin.Context) {
	code := c.Query("authCode")
	if code == "" {
		code = c.Query("code")
	}
	method := c.Query("method")
	redirectPath := c.Query("redirect") // 回调后重定向的路径

	// 获取基础URL
	scheme := "https"
	if c.Request.TLS == nil {
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		} else {
			scheme = "http"
		}
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	if code == "" {
		// 重定向回前端，带上错误信息
		redirectURL := fmt.Sprintf("%s%s?dingtalk_error=%s", baseURL, redirectPath, url.QueryEscape("未获取到授权码"))
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	// 获取用户信息
	userInfo, err := utils.GetDingTalkSSOUserInfo(code)
	if err != nil {
		redirectURL := fmt.Sprintf("%s%s?dingtalk_error=%s", baseURL, redirectPath, url.QueryEscape(err.Error()))
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	if method == "get_vote_token" {
		// 生成投票者令牌
		voterToken, err := services.GenerateDingTalkVoterToken(userInfo.UserID, userInfo.Name)
		if err != nil {
			redirectURL := fmt.Sprintf("%s%s?dingtalk_error=%s", baseURL, redirectPath, url.QueryEscape(err.Error()))
			c.Redirect(http.StatusFound, redirectURL)
			return
		}
		// 返回投票者令牌，重定向回前端
		redirectURL := fmt.Sprintf("%s%s?dingtalk_token=%s&dingtalk_name=%s",
			baseURL, redirectPath,
			url.QueryEscape(voterToken),
			url.QueryEscape(userInfo.Name))
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	// 对于sso_get_token，尝试查找已注册用户并返回token
	userToken, voterToken, user, err := services.DingTalkSSOLogin(userInfo.UserID, userInfo.Name)
	if err != nil {
		redirectURL := fmt.Sprintf("%s%s?dingtalk_error=%s", baseURL, redirectPath, url.QueryEscape(err.Error()))
		c.Redirect(http.StatusFound, redirectURL)
		return
	}

	// 如果有用户token，重定向到登录页面处理
	if userToken != "" {
		// 将用户信息转换为JSON
		userJSON, err := json.Marshal(user)
		if err != nil {
			redirectURL := fmt.Sprintf("%s/login?dingtalk_error=%s", baseURL, url.QueryEscape("用户信息序列化失败"))
			c.Redirect(http.StatusFound, redirectURL)
			return
		}

		redirectURL := fmt.Sprintf("%s/login?dingtalk_token=%s&dingtalk_user=%s",
			baseURL,
			url.QueryEscape(userToken),
			url.QueryEscape(string(userJSON)))
		c.Redirect(http.StatusFound, redirectURL)
	} else {
		// 未注册用户，返回投票者令牌
		redirectURL := fmt.Sprintf("%s%s?dingtalk_token=%s&dingtalk_name=%s",
			baseURL, redirectPath,
			url.QueryEscape(voterToken),
			url.QueryEscape(userInfo.Name))
		c.Redirect(http.StatusFound, redirectURL)
	}
}
