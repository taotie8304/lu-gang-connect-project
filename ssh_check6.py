import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 用 authSource=admin 访问 fastgpt 数据库
print("=== system_plugin_tools (toolId + name) ===")
mongo_cmd = (
    'docker exec lugang-ai-mongo mongosh '
    '"mongodb://root:LuGang2024Secure@localhost:27017/fastgpt?authSource=admin" '
    '--quiet --eval '
    '"db.system_plugin_tools.find({},{toolId:1,name:1,_id:0}).toArray()" 2>&1'
)
stdin, stdout, stderr = c.exec_command(mongo_cmd)
print(stdout.read().decode('utf-8', errors='replace')[:3000])

c.close()
