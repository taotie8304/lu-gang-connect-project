package ali

var ModelList = []string{
	// Qwen3.5 系列（最新，支持 thinking 模式）
	"qwen3.5-flash", "qwen3.5-plus",
	"qwen3.5-flash-2026-02-23", "qwen3.5-plus-2026-02-15",
	"qwen3.5-35b-a3b", "qwen3.5-27b", "qwen3.5-122b-a10b", "qwen3.5-397b-a17b",
	// Qwen3 系列
	"qwen3-235b-a22b", "qwen3-32b", "qwen3-30b-a3b", "qwen3-14b", "qwen3-8b",
	"qwen3-4b", "qwen3-1.7b", "qwen3-0.6b",
	// QwQ 深度思考系列
	"qwq-32b", "qwq-32b-preview",
	// Qwen 旗舰系列（latest 别名）
	"qwen-turbo", "qwen-turbo-latest",
	"qwen-plus", "qwen-plus-latest",
	"qwen-max", "qwen-max-latest",
	"qwen-max-longcontext",
	// 多模态
	"qwen-vl-max", "qwen-vl-max-latest", "qwen-vl-plus", "qwen-vl-plus-latest",
	"qwen-vl-ocr", "qwen-vl-ocr-latest",
	"qwen-audio-turbo",
	// 数学/代码
	"qwen-math-plus", "qwen-math-plus-latest", "qwen-math-turbo", "qwen-math-turbo-latest",
	"qwen-coder-plus", "qwen-coder-plus-latest", "qwen-coder-turbo", "qwen-coder-turbo-latest",
	// Qwen2.5 系列
	"qwen2.5-72b-instruct", "qwen2.5-32b-instruct", "qwen2.5-14b-instruct", "qwen2.5-7b-instruct", "qwen2.5-3b-instruct", "qwen2.5-1.5b-instruct", "qwen2.5-0.5b-instruct",
	// Qwen2 系列
	"qwen2-72b-instruct", "qwen2-57b-a14b-instruct", "qwen2-7b-instruct", "qwen2-1.5b-instruct", "qwen2-0.5b-instruct",
	// Qwen1.5 系列
	"qwen1.5-110b-chat", "qwen1.5-72b-chat", "qwen1.5-32b-chat", "qwen1.5-14b-chat", "qwen1.5-7b-chat", "qwen1.5-1.8b-chat", "qwen1.5-0.5b-chat",
	// Qwen1 系列
	"qwen-72b-chat", "qwen-14b-chat", "qwen-7b-chat", "qwen-1.8b-chat", "qwen-1.8b-longcontext-chat",
	// 视觉/音频
	"qwen2-vl-7b-instruct", "qwen2-vl-2b-instruct", "qwen-vl-v1", "qwen-vl-chat-v1",
	"qwen2-audio-instruct", "qwen-audio-chat",
	// 数学
	"qwen2.5-math-72b-instruct", "qwen2.5-math-7b-instruct", "qwen2.5-math-1.5b-instruct", "qwen2-math-72b-instruct", "qwen2-math-7b-instruct", "qwen2-math-1.5b-instruct",
	// 代码
	"qwen2.5-coder-32b-instruct", "qwen2.5-coder-14b-instruct", "qwen2.5-coder-7b-instruct", "qwen2.5-coder-3b-instruct", "qwen2.5-coder-1.5b-instruct", "qwen2.5-coder-0.5b-instruct",
	// Embedding
	"text-embedding-v1", "text-embedding-v3", "text-embedding-v2", "text-embedding-async-v2", "text-embedding-async-v1",
	// 图像生成
	"ali-stable-diffusion-xl", "ali-stable-diffusion-v1.5", "wanx-v1",
}
