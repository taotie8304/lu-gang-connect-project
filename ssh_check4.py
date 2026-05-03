import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 从 .env.local 读取 MongoDB 凭据
print("=== Reading .env.local for MongoDB URI ===")
stdin, stdout, stderr = c.exec_command(
    'grep -i MONGODB /www/server/panel/plugin/lugang-ai/docker-compose-data/projects/app/.env.local 2>/dev/null '
    '|| grep -i MONGODB /lugang-ai-data/projects/app/.env.local 2>/dev/null '
    '|| find /www -name ".env.local" 2>/dev/null | head -5'
)
print(stdout.read().decode('utf-8', errors='replace')[:500])

# 找到 docker-compose 目录
stdin2, stdout2, stderr2 = c.exec_command(
    'find /www /opt /home -name "docker-compose.yml" 2>/dev/null | grep -i lugang | head -5'
)
print("docker-compose:", stdout2.read().decode('utf-8', errors='replace'))

# 尝试直接进 mongo 容器，用 mongosh 不需要认证（内部端口）
stdin3, stdout3, stderr3 = c.exec_command(
    'docker exec lugang-ai-mongo mongosh --quiet --eval '
    '"db.adminCommand({listDatabases:1})" 2>&1 | head -c 500'
)
print("Mongo dbs:", stdout3.read().decode('utf-8', errors='replace'))

# 检查 MONGO_INITDB_ROOT_USERNAME / PASSWORD 环境变量
stdin4, stdout4, stderr4 = c.exec_command(
    'docker inspect lugang-ai-mongo --format "{{range .Config.Env}}{{.}}\n{{end}}" 2>&1 | grep -i mongo'
)
print("Mongo env:", stdout4.read().decode('utf-8', errors='replace'))

c.close()
