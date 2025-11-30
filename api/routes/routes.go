package routes

import (
	"io"
	"io/fs"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/itsHenry35/VoteFlex/api/handlers"
	"github.com/itsHenry35/VoteFlex/api/middlewares"
)

func getStaticFSHandler(staticFS fs.FS, path string) gin.HandlerFunc {
	return func(c *gin.Context) {
		content, err := staticFS.Open(path)
		if err != nil {
			c.String(http.StatusNotFound, "Not found")
			return
		}
		defer content.Close()
		http.ServeContent(c.Writer, c.Request, path, time.Time{}, content.(io.ReadSeeker))
	}
}

// SetupRouter 设置路由
func SetupRouter(staticFS fs.FS) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// API 路由
	api := r.Group("/api")

	// 公开API路由
	public := api.Group("/public")
	public.GET("/website_info", handlers.GetWebsiteInfo)
	public.POST("/dingtalk/get_user_id", handlers.DingTalkGetUserID)
	public.GET("/dingtalk/sso_redirect", handlers.DingTalkSSORedirect)
	public.GET("/dingtalk/sso_callback", handlers.DingTalkSSOCallback)

	// 投票公开接口（通过UUID或短链接访问）
	public.GET("/v/:uuid", handlers.GetPollByUUID)
	public.GET("/s/:code", handlers.GetPollByShortCode)
	public.GET("/v/:uuid/status", handlers.CheckVoteStatus)
	public.GET("/v/:uuid/results", handlers.GetPollResults)
	public.POST("/v/:uuid/vote", handlers.Vote)
	public.POST("/vote/modify", handlers.ModifyVote) // 修改投票

	// 认证API路由
	api.POST("/login", handlers.Login)
	api.POST("/dingtalk/login", handlers.DingTalkLogin)

	// 需要身份验证的API路由
	secured := api.Group("")
	secured.Use(middlewares.AuthMiddleware())

	// 用户API路由（普通用户和管理员都可访问）
	userAPI := secured.Group("/user")
	userAPI.GET("/polls", handlers.GetMyPolls)                  // 获取自己创建的投票
	userAPI.GET("/polls/:id", handlers.GetMyPoll)               // 获取单个投票详情
	userAPI.POST("/polls", handlers.CreatePoll)                 // 创建投票
	userAPI.PUT("/polls/:id", handlers.UpdatePoll)              // 更新投票
	userAPI.DELETE("/polls/:id", handlers.DeletePoll)           // 删除投票
	userAPI.POST("/polls/:id/end", handlers.EndPoll)            // 结束投票
	userAPI.POST("/polls/:id/reopen", handlers.ReopenPoll)      // 重新开启投票
	userAPI.POST("/polls/:id/shortcode", handlers.SetShortCode) // 设置短链接
	userAPI.GET("/polls/:id/records", handlers.GetVoteRecords)

	// 选项管理API
	userAPI.POST("/polls/:id/options", handlers.AddOption)                  // 添加选项
	userAPI.PUT("/polls/:id/options/:option_id", handlers.UpdateOption)     // 更新选项
	userAPI.DELETE("/polls/:id/options/:option_id", handlers.DeleteOption)  // 删除选项
	userAPI.POST("/polls/:id/options/order", handlers.UpdateOptionOrder)    // 更新选项顺序

	// 管理员API路由
	adminAPI := secured.Group("/admin")
	adminAPI.Use(middlewares.AdminMiddleware())

	// 投票管理（管理员可以查看所有投票）
	adminAPI.GET("/polls", handlers.GetAllPolls)
	adminAPI.GET("/polls/:id", handlers.GetPoll)

	// 用户管理（仅管理员）
	adminAPI.GET("/users", handlers.GetAllUsers)
	adminAPI.POST("/users", handlers.CreateUser)
	adminAPI.GET("/users/:id", handlers.GetUser)
	adminAPI.PUT("/users/:id", handlers.UpdateUser)
	adminAPI.DELETE("/users/:id", handlers.DeleteUser)
	adminAPI.POST("/users/:id/password", handlers.UpdatePassword)

	// 设置管理（仅管理员）
	adminAPI.GET("/settings", handlers.GetSettings)
	adminAPI.PUT("/settings", handlers.UpdateSettings)

	// 上传文件服务
	r.Static("/uploads", "./data/uploads")

	// 静态资源服务
	if staticFS != nil {
		assetsFS, _ := fs.Sub(staticFS, "assets")
		r.GET("/assets/*filepath", gin.WrapH(http.StripPrefix("/assets/", http.FileServer(http.FS(assetsFS)))))

		// 所有其他请求都指向前端入口点
		r.NoRoute(getStaticFSHandler(staticFS, "index.html"))
	}

	return r
}
