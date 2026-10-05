# 鲁港通 - OSG 配置（pydantic-settings，全部经环境变量 OSG_ 前缀覆盖，禁止硬编码密钥）
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OSG_", env_file=".env", extra="ignore")

    # 鲁港通 - 服务基础
    app_name: str = "lugang-osg"
    debug: bool = False

    # 鲁港通 - 数据层（生产复用现有容器，经 172.17.0.1 访问）
    database_url: str = "postgresql+psycopg2://postgres:changeme@127.0.0.1:5432/lugang_osg"
    redis_url: str = "redis://127.0.0.1:6379/3"

    # 鲁港通 - 内部 API 鉴权（FastGPT 调用与管理后台分离，spec 14）
    api_key_fastgpt: str = ""
    api_key_admin: str = ""

    # 鲁港通 - 抓取客户端
    user_agent: str = (
        "LuGangTongOfficialSourceBot/1.0 "
        "(+https://www.airscend.com/official-sources; contact=service@airscend.com)"
    )
    connect_timeout_s: float = 8.0
    read_timeout_s: float = 20.0
    total_timeout_s: float = 25.0
    max_redirects: int = 3

    # 鲁港通 - 内容限制（spec 6.3）
    max_bytes_html: int = 10 * 1024 * 1024   # HTML/JSON/XML/CSV ≤ 10MB
    max_bytes_pdf: int = 30 * 1024 * 1024    # PDF ≤ 30MB
    allowed_content_types: frozenset[str] = frozenset(
        {
            "text/html",
            "application/pdf",
            "application/json",
            "text/xml",
            "application/xml",
            "text/csv",
            "application/rss+xml",
            "application/atom+xml",
            # 鲁港通 - TID 全站栏目树在静态 .js 菜单文件里（栏目页是 JS 空壳，
            # js_menu 发现方式依赖）；实测 Content-Type 为 application/x-javascript。
            "text/javascript",
            "application/javascript",
            "application/x-javascript",
        }
    )

    # 鲁港通 - 频率限制（spec 12.2）
    source_min_interval_s: int = 10          # 单来源请求间隔 ≥ 10s
    global_concurrency: int = 3
    verify_cache_ttl_s: int = 24 * 3600      # verify 结果缓存 24h

    # 鲁港通 - 采集节点网络（境外服务器访问大陆政务网站需强制 IPv4，Phase 0 实测结论）
    force_ipv4: bool = True

    # 鲁港通 - FastGPT 导入链路（design.md §7.3；API Key 由服务器 .env 注入，禁止硬编码）
    fastgpt_base_url: str = "http://172.17.0.1:3210"
    fastgpt_api_key: str = ""
    fastgpt_chunk_size: int = 512          # 分块大小（spec：≤ 512 tokens）
    fastgpt_interval_s: float = 0.2        # 串行导入间隔（限流，spec 12.2）


@lru_cache
def get_settings() -> Settings:
    return Settings()
