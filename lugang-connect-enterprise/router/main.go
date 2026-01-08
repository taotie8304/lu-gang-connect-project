package router

import (
	"embed"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/common/config"
	"github.com/lugang-connect/enterprise/common/logger"
	"net/http"
	"os"
	"strings"
)

func SetRouter(router *gin.Engine, buildFS embed.FS) {
	SetApiRouter(router)
	SetDashboardRouter(router)
	SetRelayRouter(router)
	
	// 添加鲁港通路由
	SetLugangRouter(router)
	
	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if config.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		logger.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, buildFS)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
