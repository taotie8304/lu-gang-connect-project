package relay

import (
	"github.com/lugang-connect/enterprise/relay/adaptor"
	"github.com/lugang-connect/enterprise/relay/adaptor/aiproxy"
	"github.com/lugang-connect/enterprise/relay/adaptor/ali"
	"github.com/lugang-connect/enterprise/relay/adaptor/anthropic"
	"github.com/lugang-connect/enterprise/relay/adaptor/aws"
	"github.com/lugang-connect/enterprise/relay/adaptor/baidu"
	"github.com/lugang-connect/enterprise/relay/adaptor/cloudflare"
	"github.com/lugang-connect/enterprise/relay/adaptor/cohere"
	"github.com/lugang-connect/enterprise/relay/adaptor/coze"
	"github.com/lugang-connect/enterprise/relay/adaptor/deepl"
	"github.com/lugang-connect/enterprise/relay/adaptor/gemini"
	"github.com/lugang-connect/enterprise/relay/adaptor/ollama"
	"github.com/lugang-connect/enterprise/relay/adaptor/openai"
	"github.com/lugang-connect/enterprise/relay/adaptor/palm"
	"github.com/lugang-connect/enterprise/relay/adaptor/proxy"
	"github.com/lugang-connect/enterprise/relay/adaptor/replicate"
	"github.com/lugang-connect/enterprise/relay/adaptor/tencent"
	"github.com/lugang-connect/enterprise/relay/adaptor/vertexai"
	"github.com/lugang-connect/enterprise/relay/adaptor/xunfei"
	"github.com/lugang-connect/enterprise/relay/adaptor/zhipu"
	"github.com/lugang-connect/enterprise/relay/apitype"
)

func GetAdaptor(apiType int) adaptor.Adaptor {
	switch apiType {
	case apitype.AIProxyLibrary:
		return &aiproxy.Adaptor{}
	case apitype.Ali:
		return &ali.Adaptor{}
	case apitype.Anthropic:
		return &anthropic.Adaptor{}
	case apitype.AwsClaude:
		return &aws.Adaptor{}
	case apitype.Baidu:
		return &baidu.Adaptor{}
	case apitype.Gemini:
		return &gemini.Adaptor{}
	case apitype.OpenAI:
		return &openai.Adaptor{}
	case apitype.PaLM:
		return &palm.Adaptor{}
	case apitype.Tencent:
		return &tencent.Adaptor{}
	case apitype.Xunfei:
		return &xunfei.Adaptor{}
	case apitype.Zhipu:
		return &zhipu.Adaptor{}
	case apitype.Ollama:
		return &ollama.Adaptor{}
	case apitype.Coze:
		return &coze.Adaptor{}
	case apitype.Cohere:
		return &cohere.Adaptor{}
	case apitype.Cloudflare:
		return &cloudflare.Adaptor{}
	case apitype.DeepL:
		return &deepl.Adaptor{}
	case apitype.VertexAI:
		return &vertexai.Adaptor{}
	case apitype.Proxy:
		return &proxy.Adaptor{}
	case apitype.Replicate:
		return &replicate.Adaptor{}
	}
	return nil
}
