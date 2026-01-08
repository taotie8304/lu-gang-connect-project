package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/common/logger"
	lugangModel "github.com/lugang-connect/enterprise/internal/lugang/model"
	"github.com/lugang-connect/enterprise/model"
)

// Demo 演示接口
func Demo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "欢迎使用鲁港通企业版",
		"version": "1.0.0",
		"features": []string{
			"智能问答系统",
			"鲁港通专业知识库",
			"多AI模型支持",
			"企业级用户管理",
			"API密钥管理",
			"实时监控和日志",
		},
		"knowledge_bases": []string{
			"northbound - 香港商务、金融、投资信息",
			"southbound - 山东商务、文化、教育信息",
		},
	})
}

// GetKnowledge 获取知识库信息
func GetKnowledge(c *gin.Context) {
	knowledgeType := c.Param("type")
	
	if knowledgeType != "northbound" && knowledgeType != "southbound" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的知识库类型，支持: northbound, southbound",
		})
		return
	}

	var knowledge []lugangModel.LugangKnowledge
	err := model.DB.Where("type = ?", knowledgeType).Find(&knowledge).Error
	if err != nil {
		logger.SysError("获取知识库失败: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取知识库失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"type": knowledgeType,
		"count": len(knowledge),
		"data": knowledge,
	})
}

// SmartQuery 智能问答接口
func SmartQuery(c *gin.Context) {
	var req struct {
		Question      string `json:"question" binding:"required"`
		Language      string `json:"language"`
		UserType      string `json:"user_type"`
		KnowledgeBase string `json:"knowledge_base"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数错误: " + err.Error(),
		})
		return
	}

	// 设置默认值
	if req.Language == "" {
		req.Language = "zh"
	}
	if req.UserType == "" {
		req.UserType = "general"
	}
	if req.KnowledgeBase == "" {
		req.KnowledgeBase = "auto"
	}

	// 获取用户ID
	userID := c.GetInt("id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "用户未认证",
		})
		return
	}

	// 智能路由：根据问题内容选择知识库和AI模型
	aiService, modelUsed := selectAIService(req.Question, req.KnowledgeBase)
	
	// 模拟AI回答（实际应该调用AI服务）
	answer := generateAnswer(req.Question, req.KnowledgeBase, aiService)
	confidence := calculateConfidence(req.Question, answer)

	// 记录查询
	query := lugangModel.LugangQuery{
		UserID:        userID,
		Question:      req.Question,
		Answer:        answer,
		AIService:     aiService,
		ModelUsed:     modelUsed,
		Confidence:    confidence,
		Language:      req.Language,
		UserType:      req.UserType,
		KnowledgeBase: req.KnowledgeBase,
	}

	err := model.DB.Create(&query).Error
	if err != nil {
		logger.SysError("记录查询失败: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"question":       req.Question,
		"answer":         answer,
		"ai_service":     aiService,
		"model_used":     modelUsed,
		"confidence":     confidence,
		"knowledge_base": req.KnowledgeBase,
		"query_id":       query.ID,
	})
}

// selectAIService 智能选择AI服务
func selectAIService(question, knowledgeBase string) (string, string) {
	// 简单的规则引擎，实际应该更复杂
	if contains(question, []string{"股票", "金融", "投资", "银行", "税务"}) {
		return "deepseek", "deepseek-chat"
	}
	if contains(question, []string{"文化", "教育", "旅游", "历史", "孔子"}) {
		return "qwen", "qwen-turbo"
	}
	
	// 默认使用Deepseek
	return "deepseek", "deepseek-chat"
}

// generateAnswer 生成回答（模拟）
func generateAnswer(question, knowledgeBase, aiService string) string {
	// 这里应该调用实际的AI服务
	// 现在返回模拟回答
	
	if contains(question, []string{"香港", "股票", "交易时间"}) {
		return "香港股票交易时间为周一至周五上午9:30-12:00，下午1:00-4:00。香港股市不设涨跌停板限制，实行T+0交易制度。"
	}
	
	if contains(question, []string{"山东", "孔子", "文化"}) {
		return "山东是孔子的故乡，是儒家文化的发源地。曲阜的孔庙、孔府、孔林被誉为'三孔'，是世界文化遗产。"
	}
	
	if contains(question, []string{"青岛", "港口", "贸易"}) {
		return "青岛港是中国重要的国际贸易港口，是'一带一路'倡议的重要节点，连接亚欧大陆桥，为鲁港两地贸易提供便利。"
	}
	
	return "感谢您的提问。鲁港通企业版正在为您查询相关信息，请稍后或联系客服获取更详细的回答。"
}

// calculateConfidence 计算置信度
func calculateConfidence(question, answer string) float64 {
	// 简单的置信度计算
	if len(answer) > 50 && !contains(answer, []string{"请稍后", "联系客服"}) {
		return 0.85
	}
	if len(answer) > 20 {
		return 0.65
	}
	return 0.45
}

// contains 检查字符串是否包含关键词
func contains(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if len(text) > 0 && len(keyword) > 0 {
			// 简单的包含检查
			for i := 0; i <= len(text)-len(keyword); i++ {
				if text[i:i+len(keyword)] == keyword {
					return true
				}
			}
		}
	}
	return false
}