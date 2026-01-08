package novita

import (
	"fmt"

	"github.com/lugang-connect/enterprise/relay/meta"
	"github.com/lugang-connect/enterprise/relay/relaymode"
)

func GetRequestURL(meta *meta.Meta) (string, error) {
	if meta.Mode == relaymode.ChatCompletions {
		return fmt.Sprintf("%s/chat/completions", meta.BaseURL), nil
	}
	return "", fmt.Errorf("unsupported relay mode %d for novita", meta.Mode)
}
