import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

BASE = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/lugang_ai?authSource=admin" --quiet --eval'

print("=== 1. 当前 MongoDB 中的插件记录 ===")
stdin, stdout, stderr = c.exec_command(BASE + ' "db.system_plugins.find().toArray()" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 2. 当前 system_plugin_tools ===")
stdin, stdout, stderr = c.exec_command(BASE + ' "db.system_plugin_tools.find().toArray()" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 3. 插件服务最近日志（过滤 Error + Run tool） ===")
stdin, stdout, stderr = c.exec_command(
    'docker logs lugang-ai-plugin --since 15m 2>&1 | grep -iE "error|run tool|tool not|toolid" | tail -40'
)
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 4. 主应用最近日志（过滤 error + plugin + tool） ===")
stdin, stdout, stderr = c.exec_command(
    'docker logs lugang-ai-app --since 15m 2>&1 | grep -iE "error|plugin|tool" | tail -30'
)
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 5. MinIO 中插件文件 ===")
stdin, stdout, stderr = c.exec_command(
    'docker exec lugang-ai-minio sh -c "'
    'mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1; '
    'mc ls -r local/lugang-private/system/plugin/tools/ 2>&1 | head -20; '
    'echo ---public---; '
    'mc ls -r local/lugang-public/system/plugin/tools/ 2>&1 | head -20"'
)
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 6. 插件服务健康检查 ===")
stdin, stdout, stderr = c.exec_command(
    'curl -s http://localhost:8088/health 2>&1 | head -c 200'
)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
