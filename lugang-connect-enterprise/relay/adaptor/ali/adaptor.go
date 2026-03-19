package ali

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/relay/adaptor"
	"github.com/lugang-connect/enterprise/relay/adaptor/openai"
	"github.com/lugang-connect/enterprise/relay/meta"
	"github.com/lugang-connect/enterprise/relay/model"
	"github.com/lugang-connect/enterprise/relay/relaymode"
	"io"
	"net/http"
	"strings"
)

// https://help.aliyun.com/zh/dashscope/developer-reference/api-details

type Adaptor struct {
	meta            *meta.Meta
	useCompatMode   bool // 鲁港通 - Qwen3.5/QwQ/Qwen3 使用 OpenAI 兼容接口
	isInternetModel bool // 鲁港通 - 联网搜索模型，需要用原生协议获取 search_info
}

// isCompatibleModel 判断是否使用 OpenAI 兼容接口
// Qwen3.5、Qwen3、QwQ 系列需要兼容接口以支持 reasoning_content 和 enable_search
func isCompatibleModel(modelName string) bool {
	name := strings.TrimSuffix(strings.ToLower(modelName), "-internet")
	return strings.HasPrefix(name, "qwen3.5") ||
		strings.HasPrefix(name, "qwq") ||
		strings.HasPrefix(name, "qwen3-")
}

// isInternetSearchModel 判断是否为联网搜索模型
func isInternetSearchModel(modelName string) bool {
	return strings.HasSuffix(strings.ToLower(modelName), "-internet")
}

func (a *Adaptor) Init(meta *meta.Meta) {
	a.meta = meta
	a.isInternetModel = isInternetSearchModel(meta.ActualModelName)
	// 鲁港通 - 联网搜索模型使用 DashScope 原生协议（才能获取 search_info）
	// 非联网搜索的 Qwen3.5/QwQ/Qwen3 仍使用 OpenAI 兼容模式
	if a.isInternetModel {
		a.useCompatMode = false
	} else {
		a.useCompatMode = isCompatibleModel(meta.ActualModelName)
	}
}

func (a *Adaptor) GetRequestURL(meta *meta.Meta) (string, error) {
	switch meta.Mode {
	case relaymode.Embeddings:
		return fmt.Sprintf("%s/api/v1/services/embeddings/text-embedding/text-embedding", meta.BaseURL), nil
	case relaymode.ImagesGenerations:
		return fmt.Sprintf("%s/api/v1/services/aigc/text2image/image-synthesis", meta.BaseURL), nil
	default:
		if a.useCompatMode {
			// 鲁港通 - 兼容接口，支持 thinking + search
			return fmt.Sprintf("%s/compatible-mode/v1/chat/completions", meta.BaseURL), nil
		}
		return fmt.Sprintf("%s/api/v1/services/aigc/text-generation/generation", meta.BaseURL), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Request, meta *meta.Meta) error {
	adaptor.SetupCommonRequestHeader(c, req, meta)
	req.Header.Set("Authorization", "Bearer "+meta.APIKey)

	if a.useCompatMode {
		// 鲁港通 - 兼容模式用标准 Content-Type 即可
		req.Header.Set("Content-Type", "application/json")
		return nil
	}

	// 旧 DashScope 接口的特殊请求头
	if meta.IsStream {
		req.Header.Set("Accept", "text/event-stream")
		req.Header.Set("X-DashScope-SSE", "enable")
	}
	if meta.Mode == relaymode.ImagesGenerations {
		req.Header.Set("X-DashScope-Async", "enable")
	}
	if a.meta.Config.Plugin != "" {
		req.Header.Set("X-DashScope-Plugin", a.meta.Config.Plugin)
	}
	return nil
}

func (a *Adaptor) ConvertRequest(c *gin.Context, relayMode int, request *model.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	switch relayMode {
	case relaymode.Embeddings:
		return ConvertEmbeddingRequest(*request), nil
	default:
		if a.useCompatMode {
			// 鲁港通 - 兼容模式直接用 OpenAI 格式请求
			return ConvertCompatRequest(*request), nil
		}
		return ConvertRequest(*request), nil
	}
}

func (a *Adaptor) ConvertImageRequest(request *model.ImageRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return ConvertImageRequest(*request), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, meta *meta.Meta, requestBody io.Reader) (*http.Response, error) {
	return adaptor.DoRequestHelper(a, c, meta, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, meta *meta.Meta) (usage *model.Usage, err *model.ErrorWithStatusCode) {
	if a.useCompatMode {
		// 鲁港通 - 兼容模式返回标准 OpenAI 格式，直接用 OpenAI handler 处理
		if meta.IsStream {
			err, _, usage = openai.StreamHandler(c, resp, relaymode.ChatCompletions)
		} else {
			err, usage = openai.Handler(c, resp, meta.PromptTokens, meta.ActualModelName)
		}
		return
	}

	// 旧 DashScope 格式处理
	if meta.IsStream {
		err, usage = StreamHandler(c, resp)
	} else {
		switch meta.Mode {
		case relaymode.Embeddings:
			err, usage = EmbeddingHandler(c, resp)
		case relaymode.ImagesGenerations:
			err, usage = ImageHandler(c, resp)
		default:
			err, usage = Handler(c, resp)
		}
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return "ali"
}
