import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 获取 MongoDB 认证凭据（从 .env.local 读取）
print("=== Get MongoDB URI ===")
stdin, stdout, stderr = c.exec_command(
    'docker exec lugang-ai-app sh -c "echo $MONGODB_URI" 2>&1'
)
mongo_uri = stdout.read().decode('utf-8', errors='replace').strip()
print("URI:", mongo_uri[:80] + "..." if len(mongo_uri) > 80 else mongo_uri)

# 使用 MongoDB URI 查询
if mongo_uri and '@' in mongo_uri:
    print("\n=== MongoDB: systemPlugins collection ===")
    # 使用完整 URI 登录
    cmd = f'docker exec lugang-ai-mongo mongosh "{mongo_uri}" --quiet --eval "db.systemPlugins.find({{}},{{\\"toolId\\":1,\\"name\\":1}}).toArray()" 2>&1'
    stdin2, stdout2, stderr2 = c.exec_command(cmd)
    print(stdout2.read().decode('utf-8', errors='replace')[:2000])
    
    # 尝试其他可能的集合名
    print("\n=== MongoDB: system_tools or pluginTools ===")
    cmd2 = f'docker exec lugang-ai-mongo mongosh "{mongo_uri}" --quiet --eval "db.getCollectionNames()" 2>&1'
    stdin3, stdout3, stderr3 = c.exec_command(cmd2)
    print(stdout3.read().decode('utf-8', errors='replace')[:2000])

# 检查插件服务的 API endpoints
print("\n=== Plugin service API routes ===")
stdin4, stdout4, stderr4 = c.exec_command(
    'curl -s http://localhost:8088/ 2>&1 | head -c 500'
)
print(stdout4.read().decode('utf-8', errors='replace'))

# 用 toolId=hk-transport-assistant 测试直接 API 调用
print("\n=== Test plugin API call (correct toolId) ===")
stdin5, stdout5, stderr5 = c.exec_command(
    'curl -s -X POST -H "Authorization: Bearer lugangplugin2025" '
    '-H "Content-Type: application/json" '
    '-d \'{"toolId":"hk-transport-assistant","inputs":{"question":"test"}}\' '
    'http://localhost:8088/tool/run 2>&1 | head -c 1000'
)
print(stdout5.read().decode('utf-8', errors='replace'))

# 用 toolId=hk 测试直接 API 调用
print("\n=== Test plugin API call (wrong toolId 'hk') ===")
stdin6, stdout6, stderr6 = c.exec_command(
    'curl -s -X POST -H "Authorization: Bearer lugangplugin2025" '
    '-H "Content-Type: application/json" '
    '-d \'{"toolId":"hk","inputs":{"question":"test"}}\' '
    'http://localhost:8088/tool/run 2>&1 | head -c 1000'
)
print(stdout6.read().decode('utf-8', errors='replace'))

c.close()
