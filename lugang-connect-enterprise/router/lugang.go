package router

import (
	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/middleware"
	lugangHandler "github.com/lugang-connect/enterprise/internal/lugang/handler"
)

func SetLugangRouter(router *gin.Engine) {
	// 鲁港通公开接口（无需认证）
	lugangGroup := router.Group("/api/lugang")
	{
		lugangGroup.GET("/demo", lugangHandler.Demo)
		lugangGroup.GET("/knowledge/:type", lugangHandler.GetKnowledge)
	}

	// 鲁港通认证接口
	lugangAuthGroup := router.Group("/api/lugang")
	lugangAuthGroup.Use(middleware.UserAuth())
	{
		lugangAuthGroup.POST("/query", lugangHandler.SmartQuery)
	}

	// 鲁港通管理接口（需要管理员权限）
	lugangAdminGroup := router.Group("/api/lugang/admin")
	lugangAdminGroup.Use(middleware.AdminAuth())
	{
		// TODO: 添加管理接口
		// lugangAdminGroup.GET("/analytics", lugangHandler.GetAnalytics)
		// lugangAdminGroup.POST("/knowledge", lugangHandler.AddKnowledge)
	}
}