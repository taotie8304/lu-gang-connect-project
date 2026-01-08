package common

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/gin-contrib/static"
	"github.com/lugang-connect/enterprise/common/logger"
)

// Credit: https://github.com/gin-contrib/static/issues/19

type embedFileSystem struct {
	http.FileSystem
}

func (e embedFileSystem) Exists(prefix string, path string) bool {
	_, err := e.Open(path)
	return err == nil
}

func EmbedFolder(fsEmbed embed.FS, targetPath string) static.ServeFileSystem {
	efs, err := fs.Sub(fsEmbed, targetPath)
	if err != nil {
		logger.SysError("Failed to load embedded folder: " + targetPath + ", error: " + err.Error())
		// 返回一个空的文件系统而不是panic
		return embedFileSystem{
			FileSystem: http.FS(fsEmbed),
		}
	}
	return embedFileSystem{
		FileSystem: http.FS(efs),
	}
}
