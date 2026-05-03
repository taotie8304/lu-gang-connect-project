import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

BASE = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/lugang_ai?authSource=admin" --quiet --eval'

print("=== 清理前 system_plugins ===")
stdin, stdout, stderr = c.exec_command(BASE + ' "db.system_plugins.find().toArray()" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

# 删除旧 toolId = hk-transport-assistant
print("\n=== 删除 MongoDB 旧记录 ===")
stdin, stdout, stderr = c.exec_command(
    BASE + ' "db.system_plugins.deleteMany({toolId:\'hk-transport-assistant\'}); '
    'db.system_plugin_tools.deleteMany({pluginId:\'systemTool-hk-transport-assistant\'})" 2>&1'
)
print(stdout.read().decode('utf-8', errors='replace'))

print("\n=== 清理后 system_plugins ===")
stdin, stdout, stderr = c.exec_command(BASE + ' "db.system_plugins.find().toArray()" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

# 重启插件服务刷新缓存
print("\n=== 重启 lugang-ai-plugin ===")
stdin, stdout, stderr = c.exec_command('docker restart lugang-ai-plugin 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
print("\n完成。现在去前端：删除/重新上传新的 hk_transport_assistant.pkg，然后把工作流里的旧插件节点删掉，重新拖入新插件。")
