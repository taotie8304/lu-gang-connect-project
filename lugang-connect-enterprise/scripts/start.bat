@echo off
chcp 65001 >nul
echo 🌉 启动鲁港通企业版
echo ====================

REM 检查Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker未运行，请先启动Docker Desktop
    pause
    exit /b 1
)

REM 检查环境变量文件
if not exist .env (
    echo 📝 创建环境变量文件...
    copy .env.example .env
    echo ⚠️ 请编辑 .env 文件配置API密钥
)

echo 🧹 清理旧容器...
docker-compose down

echo 📦 构建并启动服务...
docker-compose up --build -d

echo ⏳ 等待服务启动...
timeout /t 15 /nobreak >nul

echo 🔍 检查服务状态...
docker-compose ps

echo.
echo ✅ 鲁港通企业版启动完成！
echo.
echo 📋 访问地址：
echo   - 🌉 管理界面: http://localhost:3000
echo   - 📚 API文档: http://localhost:3000/docs
echo   - 🎯 演示页面: http://localhost:3000/api/lugang/demo
echo.
echo 👤 默认管理员账号：
echo   - 用户名: root
echo   - 密码: 123456
echo   - ⚠️ 首次登录后请立即修改密码
echo.
echo 🔧 配置说明：
echo   1. 编辑 .env 文件设置API密钥
echo   2. 重启服务: docker-compose restart
echo   3. 查看日志: docker-compose logs -f
echo.
echo 🎉 欢迎使用鲁港通企业版！
echo.
pause