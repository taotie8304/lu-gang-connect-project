# 鲁港通 - FastGPT 开放 API 客户端测试（TDD）：MockTransport 注入，不发真实网络
import json

import httpx
import pytest

from app.fastgpt.client import FastGPTClient, FastGPTError

BASE = "http://127.0.0.1:3210"
KEY = "fastgpt-test-key"


def make_client(handler: httpx.MockTransport) -> FastGPTClient:
    return FastGPTClient(BASE, KEY, transport=httpx.MockTransport(handler))


def ok(data):
    return httpx.Response(200, json={"code": 200, "statusText": "", "message": "", "data": data})


def test_bearer_auth_header():
    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("Authorization")
        seen["url"] = str(request.url)
        return ok([])

    make_client(handler).list_datasets()
    assert seen["auth"] == f"Bearer {KEY}"
    assert seen["url"] == f"{BASE}/api/core/dataset/list"


def test_error_code_raises_chinese_message():
    def handler(request):
        return httpx.Response(
            200, json={"code": 403, "statusText": "unauthorized", "message": "无权操作"}
        )

    with pytest.raises(FastGPTError, match="无权操作"):
        make_client(handler).list_datasets()


def test_non_json_response_raises():
    def handler(request):
        return httpx.Response(502, text="<html>bad gateway</html>")

    with pytest.raises(FastGPTError, match="非 JSON"):
        make_client(handler).list_datasets()


def test_create_folder_payload_and_result():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["payload"] = json.loads(request.content)
        return ok("c0ffee000000000000000001")

    fid = make_client(handler).create_folder("ds1", "工业贸易署")
    assert fid == "c0ffee000000000000000001"
    assert seen["path"] == "/api/core/dataset/collection/create"
    assert seen["payload"] == {"datasetId": "ds1", "name": "工业贸易署", "type": "folder"}


def test_create_folder_with_parent():
    seen = {}

    def handler(request):
        seen["payload"] = json.loads(request.content)
        return ok("f2")

    make_client(handler).create_folder("ds1", "CEPA", parent_id="f1")
    assert seen["payload"]["parentId"] == "f1"


def test_create_text_payload_and_result():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["payload"] = json.loads(request.content)
        return ok({"collectionId": "c1", "results": {"insertLen": 3}})

    cid = make_client(handler).create_text(
        "ds1", "标题", "正文", parent_id="p1", tags=["香港", "工业贸易署"], chunk_size=512
    )
    assert cid == "c1"
    assert seen["path"] == "/api/core/dataset/collection/create/text"
    payload = seen["payload"]
    assert payload["datasetId"] == "ds1"
    assert payload["name"] == "标题"
    assert payload["text"] == "正文"
    assert payload["parentId"] == "p1"
    assert payload["tags"] == ["香港", "工业贸易署"]
    assert payload["chunkSize"] == 512


def test_create_text_includes_custom_chunk_settings():
    # 显式自定义分块：FastGPT 默认 auto 会把 chunkSize 覆盖为 1000，须显式声明 custom
    seen = {}

    def handler(request):
        seen["payload"] = json.loads(request.content)
        return ok({"collectionId": "c1", "results": {"insertLen": 3}})

    make_client(handler).create_text("ds1", "标题", "正文")
    payload = seen["payload"]
    assert payload["chunkSettingMode"] == "custom"
    assert payload["chunkSplitMode"] == "paragraph"
    assert payload["paragraphChunkDeep"] == 5
    assert payload["indexPrefixTitle"] is True
    assert payload["chunkSize"] == 512
    assert payload["indexSize"] == 512


def test_create_text_chunk_settings_overridable():
    seen = {}

    def handler(request):
        seen["payload"] = json.loads(request.content)
        return ok({"collectionId": "c1", "results": {"insertLen": 3}})

    make_client(handler).create_text(
        "ds1",
        "标题",
        "正文",
        chunk_size=256,
        index_size=256,
        index_prefix_title=False,
        chunk_setting_mode="auto",
        chunk_split_mode="size",
        paragraph_chunk_deep=3,
    )
    payload = seen["payload"]
    assert payload["chunkSettingMode"] == "auto"
    assert payload["chunkSplitMode"] == "size"
    assert payload["paragraphChunkDeep"] == 3
    assert payload["indexPrefixTitle"] is False
    assert payload["chunkSize"] == 256
    assert payload["indexSize"] == 256


def test_rename_collection():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["payload"] = json.loads(request.content)
        return ok(None)

    make_client(handler).rename("c1", "纯标题")
    assert seen["path"] == "/api/core/dataset/collection/update"
    assert seen["payload"] == {"id": "c1", "name": "纯标题"}


def test_delete_collections():
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["payload"] = json.loads(request.content)
        return ok(None)

    make_client(handler).delete_collections(["c1", "c2"])
    assert seen["path"] == "/api/core/dataset/collection/delete"
    assert seen["payload"] == {"collectionIds": ["c1", "c2"]}


def test_list_collections_folders_only_and_pagination():
    calls = []

    def handler(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if payload["offset"] == 0:
            return ok({"list": [{"_id": "a", "name": "工业贸易署", "parentId": None}], "total": 2})
        return ok({"list": [{"_id": "b", "name": "教育局", "parentId": None}], "total": 2})

    items = make_client(handler).list_collections("ds1")
    assert [i["_id"] for i in items] == ["a", "b"]
    assert calls[0]["selectFolder"] is True
    assert calls[0]["parentId"] is None
    assert calls[0]["pageSize"] == 100
    assert calls[1]["offset"] == 100


def test_close_releases_client():
    make_client(lambda r: ok([])).close()
