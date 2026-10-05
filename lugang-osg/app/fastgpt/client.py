# 鲁港通 - FastGPT 开放 API 客户端（OSG 导入链路，design.md §7.3）：
# Bearer API Key 鉴权；httpx 实现（transport 可注入，测试走 MockTransport 不发真实网络）。
from typing import Any

import httpx

DEFAULT_TIMEOUT_S = 30.0
PAGE_SIZE = 100


class FastGPTError(Exception):
    """FastGPT 接口异常（非 200 业务码 / 响应不可解析 / 连接失败），消息面向使用者。"""


class FastGPTClient:
    """FastGPT 后台开放 API 的最小客户端：文件夹 / 文本集合 / 改名 / 删除 / 列表。"""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        timeout: float = DEFAULT_TIMEOUT_S,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
            transport=transport,
        )

    # --- 基础请求 ---

    def _post(self, path: str, payload: dict[str, Any]) -> Any:
        try:
            resp = self._http.post(path, json=payload)
        except httpx.HTTPError as exc:
            raise FastGPTError(
                f"连接 FastGPT 失败：{exc}（请检查 OSG_FASTGPT_BASE_URL 与服务状态）"
            ) from exc
        try:
            body = resp.json()
        except ValueError as exc:
            raise FastGPTError(
                f"FastGPT 响应非 JSON（HTTP {resp.status_code}）：{resp.text[:200]}"
            ) from exc
        code = body.get("code")
        if code != 200:
            message = body.get("message") or body.get("statusText") or "未知错误"
            raise FastGPTError(f"FastGPT 接口错误（code={code}）：{message}")
        return body.get("data")

    # --- 数据集 ---

    def list_datasets(self) -> list[dict[str, Any]]:
        """数据集列表（连通性自检用）。"""
        return self._post("/api/core/dataset/list", {}) or []

    # --- 集合 ---

    def list_collections(
        self,
        dataset_id: str,
        parent_id: str | None = None,
        *,
        folders_only: bool = True,
    ) -> list[dict[str, Any]]:
        """分页拉取指定父目录下的集合（默认仅文件夹），返回全部条目。"""
        collected: list[dict[str, Any]] = []
        offset = 0
        while True:
            data = self._post(
                "/api/core/dataset/collection/listV2",
                {
                    "datasetId": dataset_id,
                    "parentId": parent_id,
                    "selectFolder": folders_only,
                    "simple": True,
                    "pageSize": PAGE_SIZE,
                    "offset": offset,
                },
            ) or {}
            batch = data.get("list") or []
            collected.extend(batch)
            total = data.get("total") or 0
            if not batch or len(collected) >= total:
                return collected
            offset += PAGE_SIZE

    def create_folder(
        self, dataset_id: str, name: str, parent_id: str | None = None
    ) -> str:
        """创建文件夹，返回 collectionId。"""
        payload: dict[str, Any] = {"datasetId": dataset_id, "name": name, "type": "folder"}
        if parent_id:
            payload["parentId"] = parent_id
        return self._post("/api/core/dataset/collection/create", payload)

    def create_text(
        self,
        dataset_id: str,
        name: str,
        text: str,
        *,
        parent_id: str | None = None,
        tags: list[str] | None = None,
        chunk_size: int = 512,
        index_size: int = 512,
        index_prefix_title: bool = True,
        chunk_setting_mode: str = "custom",
        chunk_split_mode: str = "paragraph",
        paragraph_chunk_deep: int = 5,
    ) -> str:
        """创建文本集合（一篇文章 = 一个集合），返回 collectionId。

        鲁港通 - 显式声明自定义分块：FastGPT 默认 auto 模式会在训练解析时把
        入参 chunkSize 强制覆盖为 1000，导入侧必须传 custom 才能让 512 生效；
        indexPrefixTitle 让训练时为向量索引附加「# 标题」前缀（提升检索命中）。
        """
        payload: dict[str, Any] = {
            "datasetId": dataset_id,
            "name": name,
            "text": text,
            "chunkSize": chunk_size,
            "indexSize": index_size,
            "indexPrefixTitle": index_prefix_title,
            "chunkSettingMode": chunk_setting_mode,
            "chunkSplitMode": chunk_split_mode,
            "paragraphChunkDeep": paragraph_chunk_deep,
        }
        if parent_id:
            payload["parentId"] = parent_id
        if tags:
            payload["tags"] = tags
        data = self._post("/api/core/dataset/collection/create/text", payload)
        return data["collectionId"]

    def rename(self, collection_id: str, name: str) -> None:
        """恢复集合名（text 导入会被追加 .txt 后缀）。"""
        self._post("/api/core/dataset/collection/update", {"id": collection_id, "name": name})

    def delete_collections(self, collection_ids: list[str]) -> None:
        """批量删除集合（版本变化重建时的旧集合清理）。"""
        self._post(
            "/api/core/dataset/collection/delete", {"collectionIds": collection_ids}
        )

    def close(self) -> None:
        self._http.close()
