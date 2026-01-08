#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
鲁港通 - 直接集成AI模型版本
Lu-Gang Connect - Direct AI Integration Version
智能双语知识库系统，直接调用AI模型API
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uvicorn
import httpx
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
import asyncio

# 创建FastAPI应用
app = FastAPI(
    title="鲁港通 Lu-Gang Connect",
    description="智能双语知识库系统 - Intelligent Bilingual Knowledge Base System",
    version="3.0.0-integrated",
    docs_url="/docs",
    redoc_url="/redoc",
    # 优化文档加载速度
    swagger_ui_parameters={"defaultModelsExpandDepth": -1}
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI模型配置 - 直接调用
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")

# API端点配置
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

# 数据模型
class QueryRequest(BaseModel):
    question: str
    language: str = "zh"  # zh, en, zh-hk
    user_type: str = "visitor"  # visitor, business, investor, student
    knowledge_base: str = "both"  # northbound, southbound, both

class QueryResponse(BaseModel):
    answer: str
    source: str
    confidence: float
    language: str
    timestamp: str
    ai_service: str
    model_used: str

# 鲁港通知识库数据
KNOWLEDGE_BASE = {
    "northbound": {
        "business": [
            "香港股票交易时间为周一至周五上午9:30-12:00，下午1:00-4:00",
            "香港公司注册需要提供董事身份证明、地址证明等文件",
            "香港银行开户通常需要3-5个工作日",
            "香港税率相对较低，企业所得税率为16.5%",
            "香港是国际金融中心，拥有完善的法律体系",
            "香港证券市场对内地投资者开放，通过沪港通、深港通交易"
        ],
        "investment": [
            "香港投资移民计划已暂停，可考虑优才计划",
            "香港房产投资需缴纳印花税，首次置业可享优惠",
            "香港与内地签署CEPA协议，为两地贸易提供便利"
        ],
        "logistics": [
            "香港港口是全球重要的转运枢纽",
            "香港机场货运量位居世界前列",
            "香港与内地海关实现24小时通关便利"
        ],
        "finance": [
            "香港是人民币离岸中心，提供人民币金融服务",
            "香港金融管理局监管银行业务",
            "香港交易所是亚洲重要的证券交易所"
        ]
    },
    "southbound": {
        "business": [
            "山东自贸区提供多项优惠政策支持港资企业",
            "青岛港是重要的国际贸易港口，连接一带一路",
            "济南高新区为科技企业提供税收优惠",
            "山东省对港资企业提供绿色通道服务",
            "烟台、威海等城市与韩国贸易往来密切"
        ],
        "culture": [
            "山东是孔子故乡，儒家文化发源地",
            "泰山是五岳之首，世界文化与自然双重遗产",
            "山东菜系以鲁菜为代表，注重原汁原味",
            "曲阜三孔是世界文化遗产",
            "山东剪纸、年画等传统工艺闻名全国"
        ],
        "education": [
            "山东大学是国家重点大学，在港招生",
            "中国海洋大学海洋科学全国领先",
            "山东师范大学教育学科实力雄厚",
            "青岛科技大学与香港高校有合作项目"
        ],
        "tourism": [
            "泰山登山路线多样，适合不同体力游客",
            "青岛海滨风光优美，是避暑胜地",
            "济南泉水众多，被称为泉城",
            "威海是中国最适宜居住的城市之一"
        ]
    }
}

async def call_deepseek_api(messages: List[Dict]) -> str:
    """直接调用Deepseek API"""
    try:
        if not DEEPSEEK_API_KEY:
            return "基于鲁港通知识库的回答（Deepseek API未配置）"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                return f"Deepseek API调用失败 (状态码: {response.status_code})"
                
    except Exception as e:
        return f"Deepseek API调用异常: {str(e)}"

async def call_qwen_api(messages: List[Dict]) -> str:
    """直接调用Qwen API"""
    try:
        if not QWEN_API_KEY:
            return "基于鲁港通知识库的回答（Qwen API未配置）"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                QWEN_API_URL,
                headers={
                    "Authorization": f"Bearer {QWEN_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "qwen-turbo",
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                return f"Qwen API调用失败 (状态码: {response.status_code})"
                
    except Exception as e:
        return f"Qwen API调用异常: {str(e)}"

def classify_query_type(question: str) -> tuple:
    """分类查询类型，决定使用哪个AI模型"""
    question_lower = question.lower()
    
    # 商务、金融、投资类问题 -> Deepseek
    business_keywords = ["投资", "股票", "公司", "银行", "贸易", "商务", "金融", "税收", "注册", "开户", "物流", "港口"]
    if any(keyword in question_lower for keyword in business_keywords):
        return "deepseek", "deepseek-chat"
    
    # 文化、教育、旅游类问题 -> Qwen  
    culture_keywords = ["文化", "教育", "旅游", "历史", "传统", "学校", "大学", "景点", "美食", "艺术", "泰山", "孔子"]
    if any(keyword in question_lower for keyword in culture_keywords):
        return "qwen", "qwen-turbo"
    
    # 默认使用Deepseek
    return "deepseek", "deepseek-chat"

def search_knowledge_base(question: str, kb_type: str, user_type: str) -> str:
    """搜索鲁港通知识库"""
    relevant_info = []
    
    if kb_type in ["northbound", "both"]:
        for category, items in KNOWLEDGE_BASE["northbound"].items():
            relevant_info.extend(items)
    
    if kb_type in ["southbound", "both"]:
        for category, items in KNOWLEDGE_BASE["southbound"].items():
            relevant_info.extend(items)
    
    # 关键词匹配
    question_lower = question.lower()
    matched_info = []
    
    keywords = ["股票", "投资", "公司", "银行", "贸易", "文化", "山东", "香港", "教育", "旅游", "港口", "税收", "泰山", "孔子"]
    for info in relevant_info:
        if any(keyword in question_lower or keyword in info for keyword in keywords):
            matched_info.append(info)
    
    return " ".join(matched_info[:5]) if matched_info else "鲁港通系统为您提供香港与山东之间的商务、文化、教育等信息服务。"

@app.get("/")
async def root():
    """根路径 - 系统欢迎页面"""
    return {
        "message": "欢迎使用鲁港通智能双语知识库系统",
        "welcome": "Welcome to Lu-Gang Connect Intelligent Bilingual Knowledge Base System",
        "status": "running",
        "version": "2.0.0",
        "description": "连接香港与山东的智能信息桥梁",
        "features": [
            "🤖 Deepseek AI智能问答 (商务金融)",
            "🎓 Qwen AI智能问答 (文化教育)", 
            "🔄 双向知识库查询 (香港⇄山东)",
            "🌐 多语言支持 (中文/English/粤语)",
            "👥 用户角色定制 (商务/投资/学生/访客)",
            "⚡ 实时API服务"
        ],
        "ai_services": ["Deepseek (商务)", "Qwen (文化)"],
        "knowledge_bases": ["北向(香港)", "南向(山东)"],
        "timestamp": datetime.now().isoformat(),
        "endpoints": {
            "智能问答": "/api/v1/query",
            "知识库": "/api/v1/knowledge",
            "演示接口": "/api/v1/demo",
            "演示网页": "/demo",
            "AI服务状态": "/api/v1/ai/status",
            "健康检查": "/health",
            "API文档": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "service": "lu-gang-connect",
        "version": "3.0.0-integrated",
        "timestamp": datetime.now().isoformat(),
        "ai_services": {
            "deepseek": "configured" if DEEPSEEK_API_KEY else "not_configured",
            "qwen": "configured" if QWEN_API_KEY else "not_configured"
        },
        "knowledge_base_status": "active",
        "total_knowledge_items": sum(len(items) for kb in KNOWLEDGE_BASE.values() for items in kb.values())
    }

@app.get("/api/v1/info")
async def get_system_info():
    """获取系统详细信息"""
    return {
        "name": "鲁港通 Lu-Gang Connect",
        "version": "2.0.0",
        "description": "智能双语知识库系统 - 连接香港与山东的信息桥梁",
        "architecture": "Deepseek + Qwen + 本地知识库",
        "capabilities": {
            "ai_services": {
                "deepseek": "处理商务、金融、投资、贸易类问题",
                "qwen": "处理文化、教育、旅游、历史类问题"
            },
            "knowledge_bases": {
                "northbound": "香港相关信息 (商务、投资、物流、金融)",
                "southbound": "山东相关信息 (商务、文化、教育、旅游)"
            },
            "languages": ["简体中文", "English", "繁體中文(粤语)"],
            "user_types": ["访客", "商务人士", "投资者", "学生"]
        },
        "status": "运行中",
        "startup_time": datetime.now().isoformat()
    }

@app.post("/api/v1/query", response_model=QueryResponse)
async def query_system(request: QueryRequest):
    """智能问答接口 - 鲁港通核心功能 (One API集成)"""
    try:
        # 搜索知识库
        context = search_knowledge_base(request.question, request.knowledge_base, request.user_type)
        
        # 分类查询并选择AI模型
        ai_service, model_name = classify_query_type(request.question)
        
        # 构建消息
        system_prompt = f"你是鲁港通智能助手，专门回答香港与山东之间的商务、文化、教育、投资等问题。基于以下知识库信息回答：{context}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.question}
        ]
        
        # 通过直接API调用AI模型
        if ai_service == "deepseek":
            ai_response = await call_deepseek_api(messages)
        else:
            ai_response = await call_qwen_api(messages)
        
        return QueryResponse(
            answer=ai_response,
            source=f"鲁港通{request.knowledge_base}知识库",
            confidence=0.85,
            language=request.language,
            timestamp=datetime.now().isoformat(),
            ai_service=f"{ai_service.title()} (Direct API)",
            model_used=model_name
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询处理失败: {str(e)}")

@app.get("/api/v1/ai/status")
async def get_ai_status():
    """检查AI服务连接状态"""
    deepseek_status = "configured" if DEEPSEEK_API_KEY else "not_configured"
    qwen_status = "configured" if QWEN_API_KEY else "not_configured"
    
    return {
        "deepseek": {
            "status": deepseek_status,
            "model": "deepseek-chat",
            "endpoint": DEEPSEEK_API_URL
        },
        "qwen": {
            "status": qwen_status,
            "model": "qwen-turbo", 
            "endpoint": QWEN_API_URL
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/knowledge/{kb_type}")
async def get_knowledge_base(kb_type: str):
    """获取知识库信息"""
    if kb_type not in ["northbound", "southbound", "both"]:
        raise HTTPException(status_code=400, detail="无效的知识库类型。支持: northbound, southbound, both")
    
    if kb_type == "both":
        return {
            "knowledge_base": "complete",
            "description": "鲁港通完整知识库",
            "data": KNOWLEDGE_BASE,
            "statistics": {
                "northbound_items": sum(len(items) for items in KNOWLEDGE_BASE["northbound"].values()),
                "southbound_items": sum(len(items) for items in KNOWLEDGE_BASE["southbound"].values())
            },
            "timestamp": datetime.now().isoformat()
        }
    else:
        kb_name = "香港(北向)" if kb_type == "northbound" else "山东(南向)"
        return {
            "knowledge_base": kb_type,
            "description": f"鲁港通{kb_name}知识库",
            "data": KNOWLEDGE_BASE.get(kb_type, {}),
            "statistics": {
                "total_items": sum(len(items) for items in KNOWLEDGE_BASE[kb_type].values()),
                "categories": list(KNOWLEDGE_BASE[kb_type].keys())
            },
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/v1/demo")
async def demo_endpoint():
    """演示接口 - 快速展示鲁港通核心功能"""
    return {
        "title": "鲁港通系统演示",
        "status": "运行中",
        "version": "2.0.0",
        "description": "智能双语知识库 - 连接香港与山东",
        "features": [
            "🤖 Deepseek AI (商务金融)",
            "🎓 Qwen AI (文化教育)",
            "🔄 双向知识库查询",
            "🌐 多语言支持"
        ],
        "sample_questions": [
            "香港股票交易时间是什么？",
            "山东有什么投资优惠政策？",
            "泰山有什么文化意义？"
        ],
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@app.get("/test-version")
async def test_version():
    """测试版本 - 确认代码是否更新"""
    return {
        "message": "这是新版本的代码！",
        "version": "2024-12-30-updated",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "如果您看到这个消息，说明代码已更新"
    }

@app.get("/api/v1/demo/detailed")
async def detailed_demo_endpoint():
    """详细演示接口 - 完整功能展示"""
    demo_queries = [
        {
            "question": "香港股票交易时间是什么？",
            "expected_answer": "香港股票交易时间为周一至周五上午9:30-12:00，下午1:00-4:00",
            "knowledge_base": "northbound",
            "ai_service": "Deepseek (商务金融)",
            "category": "商务金融"
        },
        {
            "question": "山东有什么投资优惠政策？",
            "expected_answer": "山东自贸区提供多项优惠政策支持港资企业，青岛港连接一带一路贸易网络",
            "knowledge_base": "southbound",
            "ai_service": "Deepseek (商务金融)",
            "category": "投资政策"
        },
        {
            "question": "泰山有什么文化意义？",
            "expected_answer": "泰山是五岳之首，世界文化与自然双重遗产，在中华文化中具有重要地位",
            "knowledge_base": "southbound",
            "ai_service": "Qwen (文化教育)",
            "category": "文化旅游"
        }
    ]
    
    return {
        "demo_title": "鲁港通系统详细演示",
        "description": "连接香港与山东的智能信息桥梁，使用Deepseek和Qwen AI提供专业问答服务",
        "sample_queries": demo_queries,
        "system_features": {
            "ai_routing": {
                "deepseek": "自动处理商务、金融、投资、贸易类问题",
                "qwen": "自动处理文化、教育、旅游、历史类问题"
            },
            "knowledge_coverage": {
                "northbound": "香港商务、金融、投资、物流信息",
                "southbound": "山东商务、文化、教育、旅游信息"
            }
        },
        "usage_example": {
            "endpoint": "/api/v1/query",
            "method": "POST",
            "payload": {
                "question": "香港公司注册需要什么文件？",
                "language": "zh",
                "user_type": "business",
                "knowledge_base": "northbound"
            }
        },
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@app.get("/demo", response_class=HTMLResponse)
async def demo_web_page():
    """现代化AI聊天演示页面 - 对标市面主流AI平台"""
    html_content = """
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>鲁港通AI - 智能双语知识库</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                background: #f7f8fc;
                height: 100vh;
                overflow: hidden;
            }
            
            .app-container {
                display: flex;
                height: 100vh;
                background: #ffffff;
            }
            
            /* 侧边栏 */
            .sidebar {
                width: 280px;
                background: #2c3e50;
                color: white;
                display: flex;
                flex-direction: column;
                border-right: 1px solid #34495e;
            }
            
            .sidebar-header {
                padding: 20px;
                border-bottom: 1px solid #34495e;
                text-align: center;
            }
            
            .logo {
                font-size: 1.5em;
                font-weight: bold;
                margin-bottom: 5px;
                color: #3498db;
            }
            
            .subtitle {
                font-size: 0.9em;
                color: #bdc3c7;
            }
            
            .new-chat-btn {
                margin: 20px;
                padding: 12px 20px;
                background: linear-gradient(135deg, #3498db, #2980b9);
                border: none;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .new-chat-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
            }
            
            .chat-history {
                flex: 1;
                overflow-y: auto;
                padding: 0 20px;
            }
            
            .chat-item {
                padding: 12px 16px;
                margin: 8px 0;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 14px;
                color: #ecf0f1;
                border-left: 3px solid transparent;
            }
            
            .chat-item:hover {
                background: #34495e;
                border-left-color: #3498db;
            }
            
            .chat-item.active {
                background: #34495e;
                border-left-color: #3498db;
            }
            
            .sidebar-footer {
                padding: 20px;
                border-top: 1px solid #34495e;
                font-size: 12px;
                color: #95a5a6;
                text-align: center;
            }
            
            /* 主聊天区域 */
            .main-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #ffffff;
            }
            
            .chat-header {
                padding: 20px 30px;
                border-bottom: 1px solid #e1e8ed;
                background: #ffffff;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .chat-title {
                font-size: 1.2em;
                font-weight: 600;
                color: #2c3e50;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                background: #27ae60;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            .model-selector {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            .model-tag {
                padding: 6px 12px;
                background: #ecf0f1;
                border-radius: 20px;
                font-size: 12px;
                color: #2c3e50;
                font-weight: 500;
            }
            
            .model-tag.active {
                background: #3498db;
                color: white;
            }
            
            /* 聊天消息区域 */
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px 30px;
                background: #f8f9fa;
            }
            
            .welcome-screen {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: #7f8c8d;
            }
            
            .welcome-icon {
                font-size: 4em;
                margin-bottom: 20px;
                color: #3498db;
            }
            
            .welcome-title {
                font-size: 1.8em;
                font-weight: 600;
                margin-bottom: 10px;
                color: #2c3e50;
            }
            
            .welcome-subtitle {
                font-size: 1.1em;
                margin-bottom: 30px;
                max-width: 500px;
                line-height: 1.6;
            }
            
            .quick-prompts {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 15px;
                max-width: 800px;
                width: 100%;
            }
            
            .prompt-card {
                padding: 20px;
                background: white;
                border-radius: 12px;
                border: 1px solid #e1e8ed;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
            }
            
            .prompt-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                border-color: #3498db;
            }
            
            .prompt-icon {
                font-size: 1.5em;
                margin-bottom: 10px;
                color: #3498db;
            }
            
            .prompt-title {
                font-weight: 600;
                margin-bottom: 8px;
                color: #2c3e50;
            }
            
            .prompt-desc {
                font-size: 0.9em;
                color: #7f8c8d;
                line-height: 1.4;
            }
            
            /* 消息气泡 */
            .message {
                margin-bottom: 20px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .message.user {
                flex-direction: row-reverse;
            }
            
            .message-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: 600;
                flex-shrink: 0;
            }
            
            .message.user .message-avatar {
                background: #3498db;
                color: white;
            }
            
            .message.assistant .message-avatar {
                background: #2c3e50;
                color: white;
            }
            
            .message-content {
                max-width: 70%;
                padding: 16px 20px;
                border-radius: 18px;
                line-height: 1.6;
                font-size: 15px;
                position: relative;
            }
            
            .message.user .message-content {
                background: #3498db;
                color: white;
                border-bottom-right-radius: 6px;
            }
            
            .message.assistant .message-content {
                background: white;
                color: #2c3e50;
                border: 1px solid #e1e8ed;
                border-bottom-left-radius: 6px;
            }
            
            .message-time {
                font-size: 11px;
                color: #95a5a6;
                margin-top: 5px;
            }
            
            .message-meta {
                font-size: 12px;
                color: #7f8c8d;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #ecf0f1;
            }
            
            .typing-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 16px 20px;
                background: white;
                border-radius: 18px;
                border-bottom-left-radius: 6px;
                border: 1px solid #e1e8ed;
                max-width: 120px;
            }
            
            .typing-dots {
                display: flex;
                gap: 4px;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                background: #95a5a6;
                border-radius: 50%;
                animation: typing 1.4s infinite ease-in-out;
            }
            
            .typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .typing-dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes typing {
                0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                40% { transform: scale(1); opacity: 1; }
            }
            
            /* 输入区域 */
            .chat-input-container {
                padding: 20px 30px;
                background: white;
                border-top: 1px solid #e1e8ed;
            }
            
            .input-wrapper {
                position: relative;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .chat-input {
                width: 100%;
                padding: 16px 60px 16px 20px;
                border: 2px solid #e1e8ed;
                border-radius: 25px;
                font-size: 15px;
                outline: none;
                transition: all 0.3s ease;
                resize: none;
                min-height: 50px;
                max-height: 120px;
                line-height: 1.4;
            }
            
            .chat-input:focus {
                border-color: #3498db;
                box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
            }
            
            .send-button {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                width: 36px;
                height: 36px;
                background: #3498db;
                border: none;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .send-button:hover {
                background: #2980b9;
                transform: translateY(-50%) scale(1.05);
            }
            
            .send-button:disabled {
                background: #bdc3c7;
                cursor: not-allowed;
                transform: translateY(-50%) scale(1);
            }
            
            .input-hint {
                font-size: 12px;
                color: #95a5a6;
                text-align: center;
                margin-top: 10px;
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .sidebar {
                    width: 260px;
                }
                
                .chat-messages {
                    padding: 15px 20px;
                }
                
                .chat-input-container {
                    padding: 15px 20px;
                }
                
                .message-content {
                    max-width: 85%;
                }
                
                .quick-prompts {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="app-container">
            <!-- 侧边栏 -->
            <div class="sidebar">
                <div class="sidebar-header">
                    <div class="logo">🌉 鲁港通AI</div>
                    <div class="subtitle">智能双语知识库</div>
                </div>
                
                <button class="new-chat-btn" onclick="startNewChat()">
                    <i class="fas fa-plus"></i> 新建对话
                </button>
                
                <div class="chat-history">
                    <div class="chat-item active">
                        <i class="fas fa-comments"></i> 当前对话
                    </div>
                    <div class="chat-item">
                        <i class="fas fa-building"></i> 香港投资咨询
                    </div>
                    <div class="chat-item">
                        <i class="fas fa-mountain"></i> 山东文化探索
                    </div>
                    <div class="chat-item">
                        <i class="fas fa-graduation-cap"></i> 教育政策咨询
                    </div>
                    <div class="chat-item">
                        <i class="fas fa-handshake"></i> 商务合作指导
                    </div>
                </div>
                
                <div class="sidebar-footer">
                    <div>Version 2.0.0</div>
                    <div>Powered by Deepseek & Qwen</div>
                </div>
            </div>
            
            <!-- 主内容区域 -->
            <div class="main-content">
                <div class="chat-header">
                    <div class="chat-title">
                        <span class="status-dot"></span>
                        鲁港通AI助手
                    </div>
                    <div class="model-selector">
                        <div class="model-tag active">Deepseek (商务)</div>
                        <div class="model-tag">Qwen (文化)</div>
                    </div>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-screen" id="welcomeScreen">
                        <div class="welcome-icon">🤖</div>
                        <div class="welcome-title">欢迎使用鲁港通AI</div>
                        <div class="welcome-subtitle">
                            我是您的专属AI助手，专门为香港与山东之间的商务、文化、教育交流提供智能咨询服务。
                            选择下方话题开始对话，或直接输入您的问题。
                        </div>
                        
                        <div class="quick-prompts">
                            <div class="prompt-card" onclick="sendQuickPrompt('香港股票交易时间和规则是什么？')">
                                <div class="prompt-icon">📈</div>
                                <div class="prompt-title">香港金融市场</div>
                                <div class="prompt-desc">了解香港股票交易时间、规则和投资机会</div>
                            </div>
                            
                            <div class="prompt-card" onclick="sendQuickPrompt('山东自贸区有哪些投资优惠政策？')">
                                <div class="prompt-icon">🏭</div>
                                <div class="prompt-title">山东投资政策</div>
                                <div class="prompt-desc">探索山东自贸区的投资机遇和优惠政策</div>
                            </div>
                            
                            <div class="prompt-card" onclick="sendQuickPrompt('泰山的文化历史意义是什么？')">
                                <div class="prompt-icon">⛰️</div>
                                <div class="prompt-title">山东文化遗产</div>
                                <div class="prompt-desc">深入了解山东丰富的文化历史底蕴</div>
                            </div>
                            
                            <div class="prompt-card" onclick="sendQuickPrompt('香港公司注册需要什么条件和文件？')">
                                <div class="prompt-icon">🏢</div>
                                <div class="prompt-title">香港公司注册</div>
                                <div class="prompt-desc">获取香港公司注册的详细指导和要求</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-input-container">
                    <div class="input-wrapper">
                        <textarea 
                            id="chatInput" 
                            class="chat-input" 
                            placeholder="输入您的问题，按 Enter 发送，Shift + Enter 换行..."
                            onkeydown="handleKeyDown(event)"
                            oninput="adjustTextareaHeight(this)"
                        ></textarea>
                        <button id="sendButton" class="send-button" onclick="sendMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    <div class="input-hint">
                        鲁港通AI基于Deepseek和Qwen模型，为您提供专业的双语咨询服务
                    </div>
                </div>
            </div>
        </div>

        <script>
            let messageId = 0;
            
            function adjustTextareaHeight(textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
            }
            
            function handleKeyDown(event) {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                }
            }
            
            function startNewChat() {
                const chatMessages = document.getElementById('chatMessages');
                const welcomeScreen = document.getElementById('welcomeScreen');
                
                chatMessages.innerHTML = '';
                chatMessages.appendChild(welcomeScreen);
                
                document.getElementById('chatInput').value = '';
            }
            
            function sendQuickPrompt(prompt) {
                document.getElementById('chatInput').value = prompt;
                sendMessage();
            }
            
            function hideWelcomeScreen() {
                const welcomeScreen = document.getElementById('welcomeScreen');
                if (welcomeScreen) {
                    welcomeScreen.style.display = 'none';
                }
            }
            
            function addMessage(content, isUser = false, isTyping = false) {
                const chatMessages = document.getElementById('chatMessages');
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
                messageDiv.id = `message-${messageId++}`;
                
                if (isTyping) {
                    messageDiv.innerHTML = `
                        <div class="message-avatar">🤖</div>
                        <div class="typing-indicator">
                            <div class="typing-dots">
                                <div class="typing-dot"></div>
                                <div class="typing-dot"></div>
                                <div class="typing-dot"></div>
                            </div>
                            <span style="font-size: 12px; color: #95a5a6;">思考中...</span>
                        </div>
                    `;
                } else {
                    const avatar = isUser ? '👤' : '🤖';
                    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    
                    messageDiv.innerHTML = `
                        <div class="message-avatar">${avatar}</div>
                        <div class="message-content">
                            ${content}
                            <div class="message-time">${time}</div>
                        </div>
                    `;
                }
                
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                return messageDiv;
            }
            
            async function sendMessage() {
                const input = document.getElementById('chatInput');
                const sendButton = document.getElementById('sendButton');
                const message = input.value.trim();
                
                if (!message) return;
                
                hideWelcomeScreen();
                
                // 添加用户消息
                addMessage(message, true);
                
                // 清空输入框并禁用发送按钮
                input.value = '';
                input.style.height = 'auto';
                sendButton.disabled = true;
                
                // 显示AI思考状态
                const typingMessage = addMessage('', false, true);
                
                try {
                    const response = await fetch('/api/v1/query', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            question: message,
                            language: 'zh',
                            user_type: 'business',
                            knowledge_base: 'both'
                        })
                    });
                    
                    // 移除思考状态
                    typingMessage.remove();
                    
                    if (response.ok) {
                        const data = await response.json();
                        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        
                        const aiResponse = `
                            ${data.answer}
                            <div class="message-meta">
                                <i class="fas fa-robot"></i> ${data.ai_service} | 
                                <i class="fas fa-database"></i> ${data.source} | 
                                <i class="fas fa-chart-line"></i> 置信度: ${(data.confidence * 100).toFixed(1)}%
                            </div>
                        `;
                        
                        addMessage(aiResponse, false);
                    } else {
                        addMessage('抱歉，服务暂时不可用，请稍后重试。', false);
                    }
                } catch (error) {
                    typingMessage.remove();
                    addMessage('网络连接出现问题，请检查网络后重试。', false);
                }
                
                sendButton.disabled = false;
            }
        </script>
    </body>
    </html>
    """
    return html_content

if __name__ == "__main__":
    print("🚀 启动鲁港通智能双语知识库系统...")
    print("🌐 访问地址: http://localhost:8000")
    print("📚 API文档: http://localhost:8000/docs")
    print("🎯 演示接口: http://localhost:8000/api/v1/demo")
    print("💡 使用Deepseek + Qwen AI，连接香港与山东")
    print("🔗 智能问答: http://localhost:8000/api/v1/query")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    )