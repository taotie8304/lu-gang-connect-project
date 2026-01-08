package service

import (
	"strings"
)

// KnowledgeBase 鲁港通知识库
var KnowledgeBase = map[string]map[string][]string{
	"northbound": {
		"business": {
			"香港股票交易时间为周一至周五上午9:30-12:00，下午1:00-4:00",
			"香港公司注册需要提供董事身份证明、地址证明等文件",
			"香港银行开户通常需要3-5个工作日",
			"香港税率相对较低，企业所得税率为16.5%",
			"香港是国际金融中心，拥有完善的法律体系",
			"香港证券市场对内地投资者开放，通过沪港通、深港通交易",
		},
		"investment": {
			"香港投资移民计划已暂停，可考虑优才计划",
			"香港房产投资需缴纳印花税，首次置业可享优惠",
			"香港与内地签署CEPA协议，为两地贸易提供便利",
		},
		"logistics": {
			"香港港口是全球重要的转运枢纽",
			"香港机场货运量位居世界前列",
			"香港与内地海关实现24小时通关便利",
		},
		"finance": {
			"香港是人民币离岸中心，提供人民币金融服务",
			"香港金融管理局监管银行业务",
			"香港交易所是亚洲重要的证券交易所",
		},
	},
	"southbound": {
		"business": {
			"山东自贸区提供多项优惠政策支持港资企业",
			"青岛港是重要的国际贸易港口，连接一带一路",
			"济南高新区为科技企业提供税收优惠",
			"山东省对港资企业提供绿色通道服务",
			"烟台、威海等城市与韩国贸易往来密切",
		},
		"culture": {
			"山东是孔子故乡，儒家文化发源地",
			"泰山是五岳之首，世界文化与自然双重遗产",
			"山东菜系以鲁菜为代表，注重原汁原味",
			"曲阜三孔是世界文化遗产",
			"山东剪纸、年画等传统工艺闻名全国",
		},
		"education": {
			"山东大学是国家重点大学，在港招生",
			"中国海洋大学海洋科学全国领先",
			"山东师范大学教育学科实力雄厚",
			"青岛科技大学与香港高校有合作项目",
		},
		"tourism": {
			"泰山登山路线多样，适合不同体力游客",
			"青岛海滨风光优美，是避暑胜地",
			"济南泉水众多，被称为泉城",
			"威海是中国最适宜居住的城市之一",
		},
	},
}

// SearchKnowledgeBase 搜索知识库
func SearchKnowledgeBase(question, kbType, userType string) string {
	var relevantInfo []string

	if kbType == "northbound" || kbType == "both" {
		for _, items := range KnowledgeBase["northbound"] {
			relevantInfo = append(relevantInfo, items...)
		}
	}

	if kbType == "southbound" || kbType == "both" {
		for _, items := range KnowledgeBase["southbound"] {
			relevantInfo = append(relevantInfo, items...)
		}
	}

	// 关键词匹配
	questionLower := strings.ToLower(question)
	var matchedInfo []string

	keywords := []string{"股票", "投资", "公司", "银行", "贸易", "文化", "山东", "香港", "教育", "旅游", "港口", "税收", "泰山", "孔子"}
	for _, info := range relevantInfo {
		for _, keyword := range keywords {
			if strings.Contains(questionLower, keyword) || strings.Contains(info, keyword) {
				matchedInfo = append(matchedInfo, info)
				break
			}
		}
	}

	if len(matchedInfo) > 0 {
		// 返回前5条匹配信息
		if len(matchedInfo) > 5 {
			matchedInfo = matchedInfo[:5]
		}
		return strings.Join(matchedInfo, " ")
	}

	return "鲁港通系统为您提供香港与山东之间的商务、文化、教育等信息服务。"
}

// ClassifyQueryType 分类查询类型
func ClassifyQueryType(question string) (string, string) {
	questionLower := strings.ToLower(question)

	// 商务、金融、投资类问题 -> Deepseek
	businessKeywords := []string{"投资", "股票", "公司", "银行", "贸易", "商务", "金融", "税收", "注册", "开户", "物流", "港口"}
	for _, keyword := range businessKeywords {
		if strings.Contains(questionLower, keyword) {
			return "deepseek", "deepseek-chat"
		}
	}

	// 文化、教育、旅游类问题 -> Qwen
	cultureKeywords := []string{"文化", "教育", "旅游", "历史", "传统", "学校", "大学", "景点", "美食", "艺术", "泰山", "孔子"}
	for _, keyword := range cultureKeywords {
		if strings.Contains(questionLower, keyword) {
			return "qwen", "qwen-turbo"
		}
	}

	// 默认使用Deepseek
	return "deepseek", "deepseek-chat"
}