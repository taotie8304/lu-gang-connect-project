package aiproxy

import "github.com/lugang-connect/enterprise/relay/adaptor/openai"

var ModelList = []string{""}

func init() {
	ModelList = openai.ModelList
}
