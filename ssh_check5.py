import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 用 root 认证登录 MongoDB，查找系统插件集合
print("=== MongoDB: 查找系统插件 ===")
mongo_cmd = (
    'docker exec lugang-ai-mongo mongosh '
    '"mongodb://root:LuGang2024Secure@localhost:27017" '
    '--quiet --eval '
    '"db.getSiblingDB(\'fastgpt\').getCollectionNames()" 2>&1'
)
stdin, stdout, stderr = c.exec_command(mongo_cmd)
print("Collections:", stdout.read().decode('utf-8', errors='replace')[:2000])

# 查找包含 toolId 的集合
print("\n=== 搜索 toolId 字段 ===")
mongo_cmd2 = (
    'docker exec lugang-ai-mongo mongosh '
    '"mongodb://root:LuGang2024Secure@localhost:27017/fastgpt" '
    '--quiet --eval '
    '"db.systemPlugins.find({},{toolId:1,name:1}).toArray()" 2>&1'
)
stdin2, stdout2, stderr2 = c.exec_command(mongo_cmd2)
print("systemPlugins:", stdout2.read().decode('utf-8', errors='replace')[:2000])

# 也尝试 plugin 集合
mongo_cmd3 = (
    'docker exec lugang-ai-mongo mongosh '
    '"mongodb://root:LuGang2024Secure@localhost:27017/fastgpt" '
    '--quiet --eval '
    '"db.plugins.find({},{toolId:1,name:1}).toArray()" 2>&1'
)
stdin3, stdout3, stderr3 = c.exec_command(mongo_cmd3)
print("plugins:", stdout3.read().decode('utf-8', errors='replace')[:2000])

# 搜索所有包含 hk toolId 的文档
mongo_cmd4 = (
    'docker exec lugang-ai-mongo mongosh '
    '"mongodb://root:LuGang2024Secure@localhost:27017/fastgpt" '
    '--quiet --eval '
    '"db.getCollectionNames().forEach(function(c){var r=db.getCollection(c).findOne({toolId:/hk/});if(r)print(c+\': \'+JSON.stringify(r).substring(0,200));})" 2>&1'
)
stdin4, stdout4, stderr4 = c.exec_command(mongo_cmd4)
print("\nSearch hk toolId across all collections:")
print(stdout4.read().decode('utf-8', errors='replace')[:3000])

c.close()
