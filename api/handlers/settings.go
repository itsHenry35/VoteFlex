package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/config"
	"github.com/itsHenry35/VoteFlex/utils"
)

// GetWebsiteInfo 获取网站信息
func GetWebsiteInfo(c *gin.Context) {
	cfg := config.Get()
	utils.ResponseOK(c, map[string]interface{}{
		"name":               cfg.Website.Name,
		"icp_beian":          cfg.Website.ICPBeian,
		"public_sec_beian":   cfg.Website.PublicSecBeian,
		"domain":             cfg.Website.Domain,
		"dingtalk_corp_id":   cfg.DingTalk.CorpID,
		"dingtalk_client_id": cfg.DingTalk.AppKey,
	})
}

// GetSettings 获取系统设置
func GetSettings(c *gin.Context) {
	cfg := config.Get()
	utils.ResponseOK(c, map[string]interface{}{
		"website": map[string]interface{}{
			"name":             cfg.Website.Name,
			"icp_beian":        cfg.Website.ICPBeian,
			"public_sec_beian": cfg.Website.PublicSecBeian,
			"domain":           cfg.Website.Domain,
		},
		"dingtalk": map[string]interface{}{
			"app_key":       cfg.DingTalk.AppKey,
			"app_secret":    cfg.DingTalk.AppSecret,
			"agent_id":      cfg.DingTalk.AgentID,
			"corp_id":       cfg.DingTalk.CorpID,
			"self_register": cfg.DingTalk.SelfRegister,
		},
	})
}

// UpdateSettingsRequest 更新设置请求
type UpdateSettingsRequest struct {
	Website struct {
		Name           string `json:"name"`
		ICPBeian       string `json:"icp_beian"`
		PublicSecBeian string `json:"public_sec_beian"`
		Domain         string `json:"domain"`
	} `json:"website"`
	DingTalk struct {
		AppKey       string `json:"app_key"`
		AppSecret    string `json:"app_secret"`
		AgentID      string `json:"agent_id"`
		CorpID       string `json:"corp_id"`
		SelfRegister bool   `json:"self_register"`
	} `json:"dingtalk"`
}

// UpdateSettings 更新系统设置
func UpdateSettings(c *gin.Context) {
	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ResponseError(c, 400, "无效请求")
		return
	}

	cfg := config.Get()

	if req.Website.Name != "" {
		cfg.Website.Name = req.Website.Name
	}
	cfg.Website.ICPBeian = req.Website.ICPBeian
	cfg.Website.PublicSecBeian = req.Website.PublicSecBeian
	cfg.Website.Domain = req.Website.Domain

	if req.DingTalk.AppKey != "" {
		cfg.DingTalk.AppKey = req.DingTalk.AppKey
	}
	if req.DingTalk.AppSecret != "" {
		cfg.DingTalk.AppSecret = req.DingTalk.AppSecret
	}
	if req.DingTalk.AgentID != "" {
		cfg.DingTalk.AgentID = req.DingTalk.AgentID
	}
	if req.DingTalk.CorpID != "" {
		cfg.DingTalk.CorpID = req.DingTalk.CorpID
	}
	cfg.DingTalk.SelfRegister = req.DingTalk.SelfRegister

	if err := config.Save(); err != nil {
		utils.ResponseError(c, 500, "保存设置失败")
		return
	}

	utils.ResponseSuccessWithCustomMessage(c, "设置已更新")
}
