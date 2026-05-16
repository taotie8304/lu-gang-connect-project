package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/lugang-connect/enterprise/common"
	"github.com/lugang-connect/enterprise/model"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 从环境变量获取数据库连接信息
	dsn := os.Getenv("SQL_DSN")
	if dsn == "" {
		// 尝试从 .env 文件读取
		dsn = getDSNFromEnvFile()
		if dsn == "" {
			fmt.Println("错误: 未找到数据库连接信息 SQL_DSN")
			return
		}
	}

	// 初始化数据库连接
	db, err := initDB(dsn)
	if err != nil {
		fmt.Printf("错误: 无法连接到数据库: %v\n", err)
		return
	}

	// 重置 root 用户密码
	newPassword := "Huijin8304*"
	doubleSHA256Password := common.DoubleSHA256Hash(newPassword)
	hashedPassword, err := common.Password2Hash(doubleSHA256Password)
	if err != nil {
		fmt.Printf("错误: 无法生成密码哈希: %v\n", err)
		return
	}

	// 更新 root 用户密码
	var user model.User
	if err := db.Where("username = ?", "root").First(&user).Error; err != nil {
		fmt.Printf("错误: 未找到 root 用户: %v\n", err)
		return
	}

	user.Password = hashedPassword
	if err := db.Save(&user).Error; err != nil {
		fmt.Printf("错误: 无法更新密码: %v\n", err)
		return
	}

	fmt.Println("成功重置 root 用户密码为: Huijin8304*")
	fmt.Println("现在可以使用以下凭据登录:")
	fmt.Println("用户名: root")
	fmt.Println("密码: Huijin8304*")
}

func getDSNFromEnvFile() string {
	file, err := os.Open(".env")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "SQL_DSN=") {
			dsn := strings.TrimPrefix(line, "SQL_DSN=")
			// 移除可能的引号
			dsn = strings.Trim(dsn, "\"'")
			return dsn
		}
	}
	return ""
}

func initDB(dsn string) (*gorm.DB, error) {
	var dialector gorm.Dialector
	if strings.HasPrefix(dsn, "postgres://") {
		dialector = postgres.Open(dsn)
	} else if strings.Contains(dsn, "@tcp(") {
		dialector = mysql.Open(dsn)
	} else {
		dialector = sqlite.Open(dsn)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})

	if err != nil {
		return nil, err
	}

	return db, nil
}