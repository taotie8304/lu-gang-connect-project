package ali

import (
	"bufio"
	"encoding/json"
	"fmt"
	"github.com/lugang-connect/enterprise/common/ctxkey"
	"github.com/lugang-connect/enterprise/common/render"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lugang-connect/enterprise/common"
	"github.com/lugang-connect/enterprise/common/helper"
	"github.com/lugang-connect/enterprise/common/logger"
	"github.com/lugang-connect/enterprise/relay/adaptor/openai"
	"github.com/lugang-connect/enterprise/relay/model"
)

// https://help.aliyun.com/document_detail/613695.html?spm=a2c4g.2399480.0.0.1adb778fAdzP9w#341800c0f8w0r

const EnableSearchModelSuffix = "-internet"

// ConvertCompatRequest 鲁港通 - 将请求转换为 OpenAI 兼容格式（Qwen3.5/QwQ/Qwen3 系列）
// 支持 enable_search 和 stream_options
func ConvertCompatRequest(request model.GeneralOpenAIRequest) *CompatChatRequest {
	enableSearch := false
	aliModel := request.Model
	if strings.HasSuffix(aliModel, EnableSearchModelSuffix) {
		enableSearch = true
		aliModel = strings.TrimSuffix(aliModel, EnableSearchModelSuffix)
	}

	// 鲁港通 - 深度思考开关：读取前端传来的 enable_thinking 参数
	// 仅对支持思考的模型传递，避免旧模型不识别此参数
	enableThinking := false
	var thinkingBudget *int
	isThinkingCapable := strings.HasPrefix(strings.ToLower(aliModel), "qwen3") ||
		strings.HasPrefix(strings.ToLower(aliModel), "qwq")
	if request.EnableThinking != nil && *request.EnableThinking && isThinkingCapable {
		enableThinking = true
		if request.ThinkingBudget != nil {
			thinkingBudget = request.ThinkingBudget
		} else {
			defaultBudget := 8000
			thinkingBudget = &defaultBudget
		}
	}

	compatReq := &CompatChatRequest{
		Model:       aliModel,
		Messages:    request.Messages,
		Stream:      request.Stream,
		Temperature: request.Temperature,
		TopP:        request.TopP,
		MaxTokens:   request.MaxTokens,
		Tools:       request.Tools,
		Stop:        request.Stop,
	}

	// 鲁港通 - 仅对支持思考的模型传递 enable_thinking
	if isThinkingCapable {
		compatReq.EnableThinking = &enableThinking
		compatReq.ThinkingBudget = thinkingBudget
	}

	if enableSearch {
		compatReq.EnableSearch = true
		// 鲁港通 - 启用搜索来源返回，让前端可以展示联网搜索的来源 URL 和标题
		compatReq.SearchOptions = &AliSearchOptions{
			EnableSource:   true,
			EnableCitation: true,
		}
		// 鲁港通 - 流式模式下请求 include_usage，让最后一个 chunk 包含完整信息
		if request.Stream {
			compatReq.StreamOptions = &model.StreamOptions{
				IncludeUsage: true,
			}
		}
	}

	return compatReq
}

func ConvertRequest(request model.GeneralOpenAIRequest) *ChatRequest {
	messages := make([]Message, 0, len(request.Messages))
	for i := 0; i < len(request.Messages); i++ {
		message := request.Messages[i]
		messages = append(messages, Message{
			Content: message.StringContent(),
			Role:    strings.ToLower(message.Role),
		})
	}
	enableSearch := false
	aliModel := request.Model
	if strings.HasSuffix(aliModel, EnableSearchModelSuffix) {
		enableSearch = true
		aliModel = strings.TrimSuffix(aliModel, EnableSearchModelSuffix)
	}
	request.TopP = helper.Float64PtrMax(request.TopP, 0.9999)

	// 鲁港通 - 深度思考开关（DashScope 原生协议）
	// 仅对支持思考的模型传递 enable_thinking 参数
	// qwen-turbo 等旧模型不支持此参数，传递会导致错误或空响应
	enableThinking := false
	var thinkingBudget *int
	isThinkingCapableModel := strings.HasPrefix(strings.ToLower(aliModel), "qwen3") ||
		strings.HasPrefix(strings.ToLower(aliModel), "qwq")
	if request.EnableThinking != nil && *request.EnableThinking && isThinkingCapableModel {
		enableThinking = true
		if request.ThinkingBudget != nil {
			thinkingBudget = request.ThinkingBudget
		} else {
			defaultBudget := 8000
			thinkingBudget = &defaultBudget
		}
	}

	params := Parameters{
		EnableSearch:      enableSearch,
		IncrementalOutput: request.Stream,
		Seed:              uint64(request.Seed),
		MaxTokens:         request.MaxTokens,
		Temperature:       request.Temperature,
		TopP:              request.TopP,
		TopK:              request.TopK,
		ResultFormat:      "message",
		Tools:             request.Tools,
	}

	// 鲁港通 - 仅对支持思考的模型传递 enable_thinking 参数
	if isThinkingCapableModel {
		params.EnableThinking = &enableThinking
		params.ThinkingBudget = thinkingBudget
	}

	// 鲁港通 - 联网搜索时启用来源返回和角标标注
	// 官方文档：DashScope 原生协议支持 enable_source + enable_citation
	// 角标格式 [1] [2] 与前端 Citation Parser 匹配
	if enableSearch {
		params.SearchOptions = &AliSearchOptions{
			EnableSource:   true,
			EnableCitation: true,
			ForcedSearch:   true,
		}
	}

	chatReq := &ChatRequest{
		Model: aliModel,
		Input: Input{
			Messages: messages,
		},
		Parameters: params,
	}
	// 鲁港通 - 诊断日志：打印发送给 DashScope 原生协议的请求体
	if reqBytes, err := json.Marshal(chatReq); err == nil {
		logger.SysError("ali native request body: " + string(reqBytes))
	}
	return chatReq
}

func ConvertEmbeddingRequest(request model.GeneralOpenAIRequest) *EmbeddingRequest {
	return &EmbeddingRequest{
		Model: request.Model,
		Input: struct {
			Texts []string `json:"texts"`
		}{
			Texts: request.ParseInput(),
		},
	}
}

func ConvertImageRequest(request model.ImageRequest) *ImageRequest {
	var imageRequest ImageRequest
	imageRequest.Input.Prompt = request.Prompt
	imageRequest.Model = request.Model
	imageRequest.Parameters.Size = strings.Replace(request.Size, "x", "*", -1)
	imageRequest.Parameters.N = request.N
	imageRequest.ResponseFormat = request.ResponseFormat

	return &imageRequest
}

func EmbeddingHandler(c *gin.Context, resp *http.Response) (*model.ErrorWithStatusCode, *model.Usage) {
	var aliResponse EmbeddingResponse
	err := json.NewDecoder(resp.Body).Decode(&aliResponse)
	if err != nil {
		return openai.ErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError), nil
	}

	err = resp.Body.Close()
	if err != nil {
		return openai.ErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError), nil
	}

	if aliResponse.Code != "" {
		return &model.ErrorWithStatusCode{
			Error: model.Error{
				Message: aliResponse.Message,
				Type:    aliResponse.Code,
				Param:   aliResponse.RequestId,
				Code:    aliResponse.Code,
			},
			StatusCode: resp.StatusCode,
		}, nil
	}
	requestModel := c.GetString(ctxkey.RequestModel)
	fullTextResponse := embeddingResponseAli2OpenAI(&aliResponse)
	fullTextResponse.Model = requestModel
	jsonResponse, err := json.Marshal(fullTextResponse)
	if err != nil {
		return openai.ErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return nil, &fullTextResponse.Usage
}

func embeddingResponseAli2OpenAI(response *EmbeddingResponse) *openai.EmbeddingResponse {
	openAIEmbeddingResponse := openai.EmbeddingResponse{
		Object: "list",
		Data:   make([]openai.EmbeddingResponseItem, 0, len(response.Output.Embeddings)),
		Model:  "text-embedding-v1",
		Usage:  model.Usage{TotalTokens: response.Usage.TotalTokens},
	}

	for _, item := range response.Output.Embeddings {
		openAIEmbeddingResponse.Data = append(openAIEmbeddingResponse.Data, openai.EmbeddingResponseItem{
			Object:    `embedding`,
			Index:     item.TextIndex,
			Embedding: item.Embedding,
		})
	}
	return &openAIEmbeddingResponse
}

func responseAli2OpenAI(response *ChatResponse) *openai.TextResponse {
	fullTextResponse := openai.TextResponse{
		Id:      response.RequestId,
		Object:  "chat.completion",
		Created: helper.GetTimestamp(),
		Choices: response.Output.Choices,
		Usage: model.Usage{
			PromptTokens:     response.Usage.InputTokens,
			CompletionTokens: response.Usage.OutputTokens,
			TotalTokens:      response.Usage.InputTokens + response.Usage.OutputTokens,
		},
	}
	// 鲁港通 - 透传联网搜索来源信息
	if response.Output.SearchInfo != nil && len(response.Output.SearchInfo.SearchResults) > 0 {
		fullTextResponse.SearchInfo = response.Output.SearchInfo
	}
	return &fullTextResponse
}

func streamResponseAli2OpenAI(aliResponse *ChatResponse) *openai.ChatCompletionsStreamResponse {
	if len(aliResponse.Output.Choices) == 0 {
		return nil
	}
	aliChoice := aliResponse.Output.Choices[0]
	var choice openai.ChatCompletionsStreamResponseChoice
	choice.Delta = aliChoice.Message
	if aliChoice.FinishReason != "null" {
		finishReason := aliChoice.FinishReason
		choice.FinishReason = &finishReason
	}
	response := openai.ChatCompletionsStreamResponse{
		Id:      aliResponse.RequestId,
		Object:  "chat.completion.chunk",
		Created: helper.GetTimestamp(),
		Model:   "qwen",
		Choices: []openai.ChatCompletionsStreamResponseChoice{choice},
	}
	return &response
}

func StreamHandler(c *gin.Context, resp *http.Response) (*model.ErrorWithStatusCode, *model.Usage) {
	var usage model.Usage
	// 鲁港通 - 收集流式响应中的 search_info（DashScope 原生协议在最后一个 chunk 返回）
	var collectedSearchInfo *AliSearchInfo
	scanner := bufio.NewScanner(resp.Body)
	scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
		if atEOF && len(data) == 0 {
			return 0, nil, nil
		}
		if i := strings.Index(string(data), "\n"); i >= 0 {
			return i + 1, data[0:i], nil
		}
		if atEOF {
			return len(data), data, nil
		}
		return 0, nil, nil
	})

	common.SetEventStreamHeaders(c)

	// 鲁港通 - 诊断日志：记录收到的 chunk 数量
	chunkCount := 0
	for scanner.Scan() {
		data := scanner.Text()
		// 鲁港通 - 诊断日志：记录前几个原始行，帮助排查 DashScope 原生协议响应格式
		if chunkCount < 5 {
			logger.SysError("ali native stream raw line [" + fmt.Sprintf("%d", chunkCount) + "]: " + data)
		}
		chunkCount++
		if len(data) < 5 || data[:5] != "data:" {
			continue
		}
		data = data[5:]

		var aliResponse ChatResponse
		err := json.Unmarshal([]byte(data), &aliResponse)
		if err != nil {
			logger.SysError("error unmarshalling stream response: " + err.Error())
			// 鲁港通 - 诊断日志：打印无法解析的原始数据
			logger.SysError("ali native unmarshal failed data: " + data)
			continue
		}
		// 鲁港通 - 诊断日志：检查是否有错误码
		if aliResponse.Code != "" {
			logger.SysError("ali native stream error: code=" + aliResponse.Code + " message=" + aliResponse.Message)
		}
		if aliResponse.Usage.OutputTokens != 0 {
			usage.PromptTokens = aliResponse.Usage.InputTokens
			usage.CompletionTokens = aliResponse.Usage.OutputTokens
			usage.TotalTokens = aliResponse.Usage.InputTokens + aliResponse.Usage.OutputTokens
		}
		// 鲁港通 - 收集 search_info（DashScope 原生协议在 output.search_info 中返回）
		if aliResponse.Output.SearchInfo != nil && len(aliResponse.Output.SearchInfo.SearchResults) > 0 {
			collectedSearchInfo = aliResponse.Output.SearchInfo
		}
		response := streamResponseAli2OpenAI(&aliResponse)
		if response == nil {
			continue
		}
		err = render.ObjectData(c, response)
		if err != nil {
			logger.SysError(err.Error())
		}
	}

	if err := scanner.Err(); err != nil {
		logger.SysError("error reading stream: " + err.Error())
	}

	// 鲁港通 - 在流式结束前，发送一个包含 search_info 的额外 chunk
	if collectedSearchInfo != nil && len(collectedSearchInfo.SearchResults) > 0 {
		searchInfoChunk := openai.ChatCompletionsStreamResponse{
			Id:         "search_info",
			Object:     "chat.completion.chunk",
			Created:    helper.GetTimestamp(),
			Model:      "qwen",
			Choices:    []openai.ChatCompletionsStreamResponseChoice{},
			SearchInfo: collectedSearchInfo,
		}
		if err := render.ObjectData(c, searchInfoChunk); err != nil {
			logger.SysError("error sending search_info chunk: " + err.Error())
		}
	}

	render.Done(c)

	// 鲁港通 - 诊断日志：总结流式响应情况
	logger.SysError(fmt.Sprintf("ali native stream summary: totalChunks=%d, promptTokens=%d, completionTokens=%d, hasSearchInfo=%v",
		chunkCount, usage.PromptTokens, usage.CompletionTokens, collectedSearchInfo != nil))

	err := resp.Body.Close()
	if err != nil {
		return openai.ErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError), nil
	}
	return nil, &usage
}

func Handler(c *gin.Context, resp *http.Response) (*model.ErrorWithStatusCode, *model.Usage) {
	ctx := c.Request.Context()
	var aliResponse ChatResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return openai.ErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError), nil
	}
	err = resp.Body.Close()
	if err != nil {
		return openai.ErrorWrapper(err, "close_response_body_failed", http.StatusInternalServerError), nil
	}
	logger.Debugf(ctx, "response body: %s\n", responseBody)
	err = json.Unmarshal(responseBody, &aliResponse)
	if err != nil {
		return openai.ErrorWrapper(err, "unmarshal_response_body_failed", http.StatusInternalServerError), nil
	}
	if aliResponse.Code != "" {
		return &model.ErrorWithStatusCode{
			Error: model.Error{
				Message: aliResponse.Message,
				Type:    aliResponse.Code,
				Param:   aliResponse.RequestId,
				Code:    aliResponse.Code,
			},
			StatusCode: resp.StatusCode,
		}, nil
	}
	fullTextResponse := responseAli2OpenAI(&aliResponse)
	fullTextResponse.Model = "qwen"
	jsonResponse, err := json.Marshal(fullTextResponse)
	if err != nil {
		return openai.ErrorWrapper(err, "marshal_response_body_failed", http.StatusInternalServerError), nil
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return nil, &fullTextResponse.Usage
}
