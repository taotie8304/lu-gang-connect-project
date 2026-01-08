package router

import (
	"embed"
	"fmt"

	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/common"
	"github.com/lugang-connect/enterprise/common/config"
	"github.com/lugang-connect/enterprise/controller"
	"github.com/lugang-connect/enterprise/middleware"
	"net/http"
	"strings"
)

func SetWebRouter(router *gin.Engine, buildFS embed.FS) {
	// 尝试从主题目录读取，如果失败则从根目录读取
	themePath := fmt.Sprintf("web/build/%s/index.html", config.Theme)
	indexPageData, err := buildFS.ReadFile(themePath)
	if err != nil {
		// 回退到根目录的index.html
		indexPageData, _ = buildFS.ReadFile("web/build/index.html")
	}

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	// 尝试从主题目录提供静态文件，如果失败则从根目录提供
	themeDir := fmt.Sprintf("web/build/%s", config.Theme)
	if _, err := buildFS.ReadDir(themeDir); err == nil {
		router.Use(static.Serve("/", common.EmbedFolder(buildFS, themeDir)))
	} else {
		router.Use(static.Serve("/", common.EmbedFolder(buildFS, "web/build")))
	}

	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPageData)
	})
}
