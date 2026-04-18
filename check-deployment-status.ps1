# 鲁港通 - 检查部署状态

$server = "156.225.30.134"
$password = "Huijin8304*"

# 创建 SSH 会话
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential("root", $securePassword)

Write-Host "连接到服务器 $server..."

# 执行检查脚本
$commands = @"
cd /www/wwwroot/lugang-ai
bash check-features.sh
"@

# 使用 plink（PuTTY）或直接 SSH
# 如果没有 plink，我们需要手动输入密码
Write-Host "请手动执行以下命令："
Write-Host ""
Write-Host "ssh root@$server"
Write-Host "密码: $password"
Write-Host ""
Write-Host "然后执行："
Write-Host "cd /www/wwwroot/lugang-ai"
Write-Host "bash check-features.sh"
