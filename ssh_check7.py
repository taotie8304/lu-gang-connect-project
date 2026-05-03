import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

MONGO = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/fastgpt?authSource=admin" --quiet --eval'

# 1. 搜索 apps 集合中包含 "hk" toolId 的节点
print("=== apps: 搜索含 hk 的工具节点 ===")
stdin, stdout, stderr = c.exec_command(
    f'{MONGO} '
    '"db.apps.find({{\\"modules.inputs.value\\":{{\\$regex:\\"hk\\"}}}},{{\\"name\\":1,\\"modules.flowNodeType\\":1,\\"modules.inputs\\":1}}).toArray()" 2>&1 | head -c 3000'
)
print(stdout.read().decode('utf-8', errors='replace'))

# 2. 直接搜索 apps 里含有 hk toolId 的应用
print("\n=== apps: 搜索 toolId hk ===")
stdin2, stdout2, stderr2 = c.exec_command(
    f'{MONGO} '
    '"JSON.stringify(db.apps.find({},{{\\"name\\":1,\\"type\\":1}}).toArray())" 2>&1 | head -c 2000'
)
print(stdout2.read().decode('utf-8', errors='replace'))

# 3. 检查 system_plugin_tools 实际映射的集合（MongoSystemPlugin）
print("\n=== system_plugins 集合 ===")
stdin3, stdout3, stderr3 = c.exec_command(
    f'{MONGO} '
    '"db.system_plugins.find({},{{\\"toolId\\":1,\\"name\\":1}}).toArray()" 2>&1'
)
print(stdout3.read().decode('utf-8', errors='replace'))

# 4. 检查 plugin service 的 MongoDB 数据库
print("\n=== 列出所有数据库 ===")
stdin4, stdout4, stderr4 = c.exec_command(
    'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017?authSource=admin" '
    '--quiet --eval "db.adminCommand({listDatabases:1}).databases.map(d=>d.name)" 2>&1'
)
print(stdout4.read().decode('utf-8', errors='replace'))

c.close()
