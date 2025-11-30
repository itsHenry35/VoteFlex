package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

var (
	config *Config
	once   sync.Once
)

// Config 应用配置结构
type Config struct {
	Server struct {
		Port int    `json:"port"`
		Host string `json:"host"`
	} `json:"server"`
	Database struct {
		Path string `json:"path"`
	} `json:"database"`
	DingTalk struct {
		AppKey       string `json:"app_key"`        // 同时用作 SSO 的 Client ID
		AppSecret    string `json:"app_secret"`     // 同时用作 SSO 的 Client Secret
		AgentID      string `json:"agent_id"`
		CorpID       string `json:"corp_id"`
		SelfRegister bool   `json:"self_register"`  // 允许钉钉自助注册
	} `json:"dingtalk"`
	Security struct {
		JWTSecret string `json:"jwt_secret"`
	} `json:"security"`
	Website struct {
		Name           string `json:"name"`
		ICPBeian       string `json:"icp_beian"`
		PublicSecBeian string `json:"public_sec_beian"`
		Domain         string `json:"domain"`
	} `json:"website"`
}

// Load 加载配置文件
func Load() error {
	var err error
	once.Do(func() {
		config = &Config{}

		// 默认配置
		config.Server.Port = 8080
		config.Server.Host = "localhost"
		config.Database.Path = "./data/voteflex.db"
		config.Security.JWTSecret = "default-jwt-secret-please-change-in-production"
		config.Website.Name = "VoteFlex 投票系统"
		config.Website.ICPBeian = ""
		config.Website.PublicSecBeian = ""
		config.Website.Domain = ""

		// 检查配置文件是否存在
		if _, statErr := os.Stat("config.json"); os.IsNotExist(statErr) {
			// 配置文件不存在，创建默认配置
			data, marshalErr := json.MarshalIndent(config, "", "  ")
			if marshalErr != nil {
				err = fmt.Errorf("error creating default config: %v", marshalErr)
				return
			}

			if writeErr := os.WriteFile("config.json", data, 0644); writeErr != nil {
				err = fmt.Errorf("error writing default config: %v", writeErr)
				return
			}

			fmt.Println("Created default config.json")
		} else {
			// 配置文件存在，读取配置
			data, readErr := os.ReadFile("config.json")
			if readErr != nil {
				err = fmt.Errorf("error reading config: %v", readErr)
				return
			}

			if unmarshalErr := json.Unmarshal(data, config); unmarshalErr != nil {
				err = fmt.Errorf("error parsing config: %v", unmarshalErr)
				return
			}
		}
	})

	return err
}

// Get 获取配置实例
func Get() *Config {
	if config == nil {
		err := Load()
		if err != nil {
			return nil
		}
	}
	return config
}

// Save 保存当前配置到文件
func Save() error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling config: %v", err)
	}

	return os.WriteFile("config.json", data, 0644)
}
