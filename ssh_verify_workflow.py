import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

BASE = 'docker exec lugang-ai-mongo mongosh "mongodb://root:LuGang2024Secure@localhost:27017/lugang_ai?authSource=admin" --quiet --eval'

# 查询当前工作流最新版本里的 plugin 节点 pluginId
print("=== 应用工作流最新版本中的插件节点 pluginId ===")
query = (
    'var latest = db.app_versions.find().sort({_id:-1}).limit(1).next(); '
    'var out = []; '
    'if (latest && latest.nodes) { '
    '  latest.nodes.forEach(function(n){ '
    '    if (n.pluginId || n.flowNodeType===\\"tool\\" || (n.toolConfig && n.toolConfig.systemTool)) { '
    '      out.push({ '
    '        nodeId: n.nodeId, '
    '        name: n.name, '
    '        flowNodeType: n.flowNodeType, '
    '        pluginId: n.pluginId, '
    '        systemToolId: n.toolConfig && n.toolConfig.systemTool && n.toolConfig.systemTool.toolId '
    '      }); '
    '    } '
    '  }); '
    '} '
    'print(JSON.stringify(out, null, 2));'
)
stdin, stdout, stderr = c.exec_command(BASE + ' "' + query + '" 2>&1')
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
