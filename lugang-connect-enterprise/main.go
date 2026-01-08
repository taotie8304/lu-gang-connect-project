package main

import (
	"embed"
	"fmt"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	_ "github.com/joho/godotenv/autoload"
	"github.com/lugang-connect/enterprise/common"
	"github.com/lugang-connect/enterprise/common/client"
	"github.com/lugang-connect/enterprise/common/config"
	"github.com/lugang-connect/enterprise/common/logger"
	"github.com/lugang-connect/enterprise/controller"
	"github.com/lugang-connect/enterprise/middleware"
	"github.com/lugang-connect/enterprise/model"
	lugangModel "github.com/lugang-connect/enterprise/internal/lugang/model"
	"github.com/lugang-connect/enterprise/relay/adaptor/openai"
	"github.com/lugang-connect/enterprise/router"
	"os"
	"strconv"
)

//go:embed web/build/*
var buildFS embed.FS

func main() {
	common.Init()
	logger.SetupLogger()
	logger.SysLogf("鲁港通企业版 %s 启动", common.Version)

	if os.Getenv("GIN_MODE") != gin.DebugMode {
		gin.SetMode(gin.ReleaseMode)
	}
	if config.DebugEnabled {
		logger.SysLog("running in debug mode")
	}

	// Initialize SQL Database
	model.InitDB()
	model.InitLogDB()

	var err error
	err = model.CreateRootAccountIfNeed()
	if err != nil {
		logger.FatalLog("database init error: " + err.Error())
	}
	
	// 初始化鲁港通数据表
	err = lugangModel.InitLugangTables(model.DB)
	if err != nil {
		logger.FatalLog("lugang database init error: " + err.Error())
	}
	logger.SysLog("鲁港通数据库初始化完成")
	
	defer func() {
		err := model.CloseDB()
		if err != nil {
			logger.FatalLog("failed to close database: " + err.Error())
		}
	}()

	// Initialize Redis (可选，不影响主程序运行)
	err = common.InitRedisClient()
	if err != nil {
		logger.SysError("Redis initialization failed (optional): " + err.Error())
		// Redis是可选的，不影响主程序运行
	}

	// Initialize options
	model.InitOptionMap()
	logger.SysLog(fmt.Sprintf("using theme %s", config.Theme))
	if common.RedisEnabled {
		// for compatibility with old versions
		config.MemoryCacheEnabled = true
	}
	if config.MemoryCacheEnabled {
		logger.SysLog("memory cache enabled")
		logger.SysLog(fmt.Sprintf("sync frequency: %d seconds", config.SyncFrequency))
		model.InitChannelCache()
	}
	if config.MemoryCacheEnabled {
		go model.SyncOptions(config.SyncFrequency)
		go model.SyncChannelCache(config.SyncFrequency)
	}
	if os.Getenv("CHANNEL_TEST_FREQUENCY") != "" {
		frequency, err := strconv.Atoi(os.Getenv("CHANNEL_TEST_FREQUENCY"))
		if err != nil {
			logger.FatalLog("failed to parse CHANNEL_TEST_FREQUENCY: " + err.Error())
		}
		go controller.AutomaticallyTestChannels(frequency)
	}
	if os.Getenv("BATCH_UPDATE_ENABLED") == "true" {
		config.BatchUpdateEnabled = true
		logger.SysLog("batch update enabled with interval " + strconv.Itoa(config.BatchUpdateInterval) + "s")
		model.InitBatchUpdater()
	}
	if config.EnableMetric {
		logger.SysLog("metric enabled, will disable channel if too much request failed")
	}
	openai.InitTokenEncoders()
	client.Init()

	// Initialize HTTP server
	server := gin.New()
	server.Use(gin.Recovery())
	// This will cause SSE not to work!!!
	//server.Use(gzip.Gzip(gzip.DefaultCompression))
	server.Use(middleware.RequestId())
	middleware.SetUpLogger(server)
	// Initialize session store
	store := cookie.NewStore([]byte(config.SessionSecret))
	server.Use(sessions.Sessions("session", store))

	router.SetRouter(server, buildFS)
	var port = os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}
	logger.SysLogf("鲁港通企业版服务启动: http://localhost:%s", port)
	err = server.Run(":" + port)
	if err != nil {
		logger.FatalLog("failed to start HTTP server: " + err.Error())
	}
}
