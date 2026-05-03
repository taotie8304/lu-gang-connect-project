import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 直接调用插件服务，传入正确的 toolId
print("=== 直接调用插件服务测试 ===")
test_cmd = (
    'curl -s -X POST '
    '-H "Authorization: Bearer lugangplugin2025" '
    '-H "Content-Type: application/json" '
    '-d \'{"toolId":"hk_transport_assistant","inputs":{"question":"从落马洲口岸到香港立法会怎么走","language":"zh-CN"},"systemVar":{}}\' '
    'http://localhost:8088/api/tools/run 2>&1 | head -c 5000'
)
stdin, stdout, stderr = c.exec_command(test_cmd)
print(stdout.read().decode('utf-8', errors='replace'))

# 查看插件服务最新日志
print("\n=== 插件服务最新 30 行日志 ===")
stdin, stdout, stderr = c.exec_command('docker logs lugang-ai-plugin --tail 30 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
