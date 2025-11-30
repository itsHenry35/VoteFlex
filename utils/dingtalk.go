package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/itsHenry35/VoteFlex/config"
)

// DingTalkToken 钉钉访问令牌结构
type DingTalkToken struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ExpiresAt   time.Time
}

var (
	dingTalkToken *DingTalkToken
)

// GetDingTalkToken 获取钉钉访问令牌
func GetDingTalkToken() (string, error) {
	// 检查令牌是否存在且有效
	if dingTalkToken != nil && time.Now().Before(dingTalkToken.ExpiresAt) {
		return dingTalkToken.AccessToken, nil
	}

	// 获取配置
	cfg := config.Get()
	appKey := cfg.DingTalk.AppKey
	appSecret := cfg.DingTalk.AppSecret

	// 检查配置是否完整
	if appKey == "" || appSecret == "" {
		return "", fmt.Errorf("钉钉配置不完整")
	}

	// 请求URL
	url := fmt.Sprintf("https://oapi.dingtalk.com/gettoken?appkey=%s&appsecret=%s", appKey, appSecret)

	// 最大重试次数
	maxRetries := 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoffTime := time.Duration(500*1<<uint(attempt-1)) * time.Millisecond
			time.Sleep(backoffTime)
			log.Printf("重试获取钉钉访问令牌，第 %d 次尝试", attempt+1)
		}

		resp, err := http.Get(url)
		if err != nil {
			lastErr = fmt.Errorf("failed to request DingTalk token: %v", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %v", err)
			continue
		}

		var result struct {
			ErrCode     int    `json:"errcode"`
			ErrMsg      string `json:"errmsg"`
			AccessToken string `json:"access_token"`
			ExpiresIn   int    `json:"expires_in"`
		}
		if err := json.Unmarshal(body, &result); err != nil {
			lastErr = fmt.Errorf("failed to parse response: %v", err)
			continue
		}

		if result.ErrCode == 88 || result.ErrCode == -1 {
			lastErr = fmt.Errorf("DingTalk API QPS limit: %s (code: %d)", result.ErrMsg, result.ErrCode)
			continue
		}

		if result.ErrCode != 0 {
			return "", fmt.Errorf("DingTalk API error: %s (code: %d)", result.ErrMsg, result.ErrCode)
		}

		dingTalkToken = &DingTalkToken{
			AccessToken: result.AccessToken,
			ExpiresIn:   result.ExpiresIn,
			ExpiresAt:   time.Now().Add(time.Second * time.Duration(result.ExpiresIn-60)),
		}

		return dingTalkToken.AccessToken, nil
	}

	return "", fmt.Errorf("获取钉钉访问令牌失败，已重试 %d 次: %v", maxRetries, lastErr)
}

// GetDingTalkUserInfo 获取钉钉用户信息
func GetDingTalkUserInfo(code string) (*DingTalkUserInfo, error) {
	maxRetries := 3
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoffTime := time.Duration(500*1<<uint(attempt-1)) * time.Millisecond
			time.Sleep(backoffTime)
			log.Printf("重试获取钉钉用户信息，第 %d 次尝试", attempt+1)
		}

		accessToken, err := GetDingTalkToken()
		if err != nil {
			lastErr = err
			continue
		}

		url := fmt.Sprintf("https://oapi.dingtalk.com/user/getuserinfo?access_token=%s&code=%s", accessToken, code)

		resp, err := http.Get(url)
		if err != nil {
			lastErr = fmt.Errorf("failed to request DingTalk user info: %v", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %v", err)
			continue
		}

		var result struct {
			ErrCode  int    `json:"errcode"`
			ErrMsg   string `json:"errmsg"`
			UserID   string `json:"userid"`
			Name     string `json:"name"`
			DeviceID string `json:"deviceId"`
		}

		if err := json.Unmarshal(body, &result); err != nil {
			lastErr = fmt.Errorf("failed to parse response: %v", err)
			continue
		}

		if result.ErrCode == 88 || result.ErrCode == -1 {
			lastErr = fmt.Errorf("DingTalk API QPS limit: %s (code: %d)", result.ErrMsg, result.ErrCode)
			continue
		}

		if result.ErrCode != 0 {
			return nil, fmt.Errorf("DingTalk API error: %s (code: %d)", result.ErrMsg, result.ErrCode)
		}

		return &DingTalkUserInfo{
			UserID:   result.UserID,
			Name:     result.Name,
			DeviceID: result.DeviceID,
		}, nil
	}

	return nil, fmt.Errorf("获取钉钉用户信息失败，已重试 %d 次: %v", maxRetries, lastErr)
}

// DingTalkUserInfo 钉钉用户信息结构
type DingTalkUserInfo struct {
	UserID   string `json:"userid"`
	Name     string `json:"name"`
	DeviceID string `json:"deviceId"`
}

// GetDingTalkSSOUserInfo 通过SSO OAuth2授权码获取钉钉用户信息
// 用于非钉钉客户端环境下的登录
func GetDingTalkSSOUserInfo(code string) (*DingTalkUserInfo, error) {
	cfg := config.Get()
	clientID := cfg.DingTalk.AppKey       // AppKey 即为 ClientID
	clientSecret := cfg.DingTalk.AppSecret // AppSecret 即为 ClientSecret

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("钉钉SSO配置不完整")
	}

	// Step 1: 获取用户访问令牌
	tokenURL := "https://api.dingtalk.com/v1.0/oauth2/userAccessToken"
	tokenBody := map[string]string{
		"clientId":     clientID,
		"clientSecret": clientSecret,
		"code":         code,
		"grantType":    "authorization_code",
	}
	tokenBodyBytes, _ := json.Marshal(tokenBody)

	req, err := http.NewRequest("POST", tokenURL, bytes.NewBuffer(tokenBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求用户令牌失败: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取响应失败: %v", err)
	}

	var tokenResult struct {
		AccessToken  string `json:"accessToken"`
		RefreshToken string `json:"refreshToken"`
		ExpireIn     int    `json:"expireIn"`
		CorpId       string `json:"corpId"`
	}
	if err := json.Unmarshal(body, &tokenResult); err != nil {
		return nil, fmt.Errorf("解析令牌响应失败: %v", err)
	}

	if tokenResult.AccessToken == "" {
		// 检查是否有错误信息
		var errResult struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}
		if err := json.Unmarshal(body, &errResult); err == nil && errResult.Message != "" {
			return nil, fmt.Errorf("获取访问令牌失败: %s", errResult.Message)
		}
		return nil, fmt.Errorf("获取访问令牌失败")
	}

	// Step 2: 获取用户信息
	userURL := "https://api.dingtalk.com/v1.0/contact/users/me"
	userReq, err := http.NewRequest("GET", userURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建用户请求失败: %v", err)
	}
	userReq.Header.Set("x-acs-dingtalk-access-token", tokenResult.AccessToken)

	userResp, err := client.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("请求用户信息失败: %v", err)
	}
	defer userResp.Body.Close()

	userBody, err := io.ReadAll(userResp.Body)
	if err != nil {
		return nil, fmt.Errorf("读取用户信息响应失败: %v", err)
	}

	var userResult struct {
		Nick    string `json:"nick"`
		UnionId string `json:"unionId"`
		OpenId  string `json:"openId"`
	}
	if err := json.Unmarshal(userBody, &userResult); err != nil {
		return nil, fmt.Errorf("解析用户信息失败: %v", err)
	}

	if userResult.UnionId == "" {
		return nil, fmt.Errorf("获取用户信息失败: unionId为空")
	}

	return &DingTalkUserInfo{
		UserID: userResult.UnionId,
		Name:   userResult.Nick,
	}, nil
}
