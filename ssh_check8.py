import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

BASE = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/fastgpt?authSource=admin" --quiet --eval'
BASE_AI = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/lugang_ai?authSource=admin" --quiet --eval'

# 1. 查看 lugang_ai 数据库集合
print("=== lugang_ai 数据库集合 ===")
stdin, stdout, stderr = c.exec_command(BASE_AI + ' "db.getCollectionNames()" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

# 2. 查看 lugang_ai 中 plugin 相关集合
print("\n=== lugang_ai: system_plugins ===")
stdin2, stdout2, stderr2 = c.exec_command(BASE_AI + ' "db.system_plugins.find().toArray()" 2>&1 | head -c 2000')
print(stdout2.read().decode('utf-8', errors='replace'))

# 3. 查看 fastgpt apps 集合（名称列表）
apps_query = BASE + ' "db.apps.find({},{name:1,type:1}).toArray()" 2>&1 | head -c 2000'
print("\n=== fastgpt apps list ===")
stdin3, stdout3, stderr3 = c.exec_command(apps_query)
print(stdout3.read().decode('utf-8', errors='replace'))

# 4. 检查 fastgpt system_plugin_tools 实际内容
print("\n=== fastgpt system_plugin_tools ===")
stdin4, stdout4, stderr4 = c.exec_command(BASE + ' "db.system_plugin_tools.find().toArray()" 2>&1 | head -c 2000')
print(stdout4.read().decode('utf-8', errors='replace'))

c.close()
