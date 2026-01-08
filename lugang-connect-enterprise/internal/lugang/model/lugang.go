package model

import (
	"time"

	"gorm.io/gorm"
)

// LugangKnowledge 鲁港通知识库模型
type LugangKnowledge struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	Category  string    `json:"category" gorm:"type:varchar(50);not null"`
	Type      string    `json:"type" gorm:"type:varchar(20);not null"` // northbound 或 southbound
	Content   string    `json:"content" gorm:"type:text;not null"`
	Keywords  string    `json:"keywords" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// LugangQuery 鲁港通查询记录模型
type LugangQuery struct {
	ID            uint      `json:"id" gorm:"primarykey"`
	UserID        int       `json:"user_id" gorm:"index"`
	Question      string    `json:"question" gorm:"type:text;not null"`
	Answer        string    `json:"answer" gorm:"type:text;not null"`
	AIService     string    `json:"ai_service" gorm:"type:varchar(50)"`
	ModelUsed     string    `json:"model_used" gorm:"type:varchar(50)"`
	Confidence    float64   `json:"confidence"`
	Language      string    `json:"language" gorm:"type:varchar(10)"`
	UserType      string    `json:"user_type" gorm:"type:varchar(20)"`
	KnowledgeBase string    `json:"knowledge_base" gorm:"type:varchar(20)"`
	CreatedAt     time.Time `json:"created_at"`
}

// LugangAnalytics 鲁港通分析统计模型
type LugangAnalytics struct {
	ID            uint      `json:"id" gorm:"primarykey"`
	Date          string    `json:"date" gorm:"type:date;not null;index"`
	QueryCount    int       `json:"query_count" gorm:"default:0"`
	UserCount     int       `json:"user_count" gorm:"default:0"`
	AvgConfidence float64   `json:"avg_confidence" gorm:"default:0"`
	TopCategory   string    `json:"top_category" gorm:"type:varchar(50)"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TableName 设置表名
func (LugangKnowledge) TableName() string {
	return "lugang_knowledge"
}

func (LugangQuery) TableName() string {
	return "lugang_queries"
}

func (LugangAnalytics) TableName() string {
	return "lugang_analytics"
}

// InitLugangTables 初始化鲁港通数据表
func InitLugangTables(db *gorm.DB) error {
	// 自动迁移表结构
	err := db.AutoMigrate(
		&LugangKnowledge{},
		&LugangQuery{},
		&LugangAnalytics{},
	)
	if err != nil {
		return err
	}

	// 初始化基础知识库数据
	return initKnowledgeData(db)
}

// initKnowledgeData 初始化知识库数据
func initKnowledgeData(db *gorm.DB) error {
	// 检查是否已有数据
	var count int64
	db.Model(&LugangKnowledge{}).Count(&count)
	if count > 0 {
		return nil // 已有数据，跳过初始化
	}

	// 插入基础知识库数据
	knowledgeData := []LugangKnowledge{
		// 北向（香港）商务信息
		{Category: "business", Type: "northbound", Content: "香港股票交易时间为周一至周五上午9:30-12:00，下午1:00-4:00", Keywords: "股票,交易时间,香港"},
		{Category: "business", Type: "northbound", Content: "香港公司注册需要提供董事身份证明、地址证明等文件", Keywords: "公司注册,香港,文件"},
		{Category: "business", Type: "northbound", Content: "香港银行开户通常需要3-5个工作日", Keywords: "银行开户,香港,时间"},
		{Category: "finance", Type: "northbound", Content: "香港税率相对较低，企业所得税率为16.5%", Keywords: "税率,香港,企业所得税"},
		
		// 南向（山东）商务信息
		{Category: "business", Type: "southbound", Content: "山东自贸区提供多项优惠政策支持港资企业", Keywords: "自贸区,山东,优惠政策,港资"},
		{Category: "business", Type: "southbound", Content: "青岛港是重要的国际贸易港口，连接一带一路", Keywords: "青岛港,国际贸易,一带一路"},
		
		// 南向（山东）文化信息
		{Category: "culture", Type: "southbound", Content: "山东是孔子故乡，儒家文化发源地", Keywords: "孔子,儒家文化,山东"},
		{Category: "culture", Type: "southbound", Content: "泰山是五岳之首，世界文化与自然双重遗产", Keywords: "泰山,五岳,世界遗产"},
		
		// 南向（山东）教育信息
		{Category: "education", Type: "southbound", Content: "山东大学是国家重点大学，在港招生", Keywords: "山东大学,重点大学,香港招生"},
		{Category: "education", Type: "southbound", Content: "中国海洋大学海洋科学全国领先", Keywords: "中国海洋大学,海洋科学"},
	}

	return db.Create(&knowledgeData).Error
}