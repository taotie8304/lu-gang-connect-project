import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

BASE = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/lugang_ai?authSource=admin" --quiet --eval'

# 1. 查看 apps 列表
print("=== lugang_ai apps 列表 ===")
stdin, stdout, stderr = c.exec_command(BASE + ' "db.apps.find({},{name:1,type:1}).toArray()" 2>&1 | head -c 3000')
print(stdout.read().decode('utf-8', errors='replace'))

# 2. 搜索含 hk toolId 的工作流 modules
print("\n=== lugang_ai: 搜索 apps 中含 hk 的 modules ===")
# 用字符串搜索
stdin2, stdout2, stderr2 = c.exec_command(
    BASE + ' "db.apps.find({modules:{$elemMatch:{inputs:{$elemMatch:{value:{$regex:\"hk\"}}}}}},{name:1,modules:{$elemMatch:{inputs:{$elemMatch:{value:{$regex:\"hk\"}}}}}}).toArray()" 2>&1 | head -c 3000'
)
print(stdout2.read().decode('utf-8', errors='replace'))

# 3. 检查 system_plugin_tools 集合内容
print("\n=== lugang_ai: system_plugin_tools ===")
stdin3, stdout3, stderr3 = c.exec_command(BASE + ' "db.system_plugin_tools.find().toArray()" 2>&1 | head -c 3000')
print(stdout3.read().decode('utf-8', errors='replace'))

# 4. 检查 lugang_ai 中的 app versions（workflow 节点配置存这里）
print("\n=== lugang_ai: app_versions (最近修改的) ===")
stdin4, stdout4, stderr4 = c.exec_command(
    BASE + ' "db.app_versions.find({},{appId:1,nodes:1}).sort({createdAt:-1}).limit(2).toArray()" 2>&1 | head -c 5000'
)
print(stdout4.read().decode('utf-8', errors='replace'))

c.close()
