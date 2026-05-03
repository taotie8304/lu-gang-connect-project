import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 上传新 pkg
sftp = c.open_sftp()
sftp.put(r'D:\lu-gang-connect-project\hk-transport-plugin\dist\hk_transport_assistant.pkg', '/tmp/pkg_v3.pkg')
sftp.close()

# 解压 + 在 plugin 容器测试三种场景
cmds = (
    'rm -rf /tmp/tv3 && mkdir -p /tmp/tv3 && '
    'cd /tmp/tv3 && unzip -o /tmp/pkg_v3.pkg >/dev/null && '
    'docker cp /tmp/tv3 lugang-ai-plugin:/tmp/tv3 && '
    'docker exec lugang-ai-plugin timeout 30 node -e "'
    "const m=require('/tmp/tv3/index.js');"
    "console.log('=== Scenario 1: 中环到尖沙咀 (市区, TDAS 应可用) ===');"
    "m.cb({question:'从中环到尖沙咀怎么走',language:'zh-CN'})"
    ".then(r=>{console.log('routes count:',r.routes.length);console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus));console.log('error:',r.error);console.log('tips:',r.tips.slice(0,3));if(r.routes[0])console.log('first route:',JSON.stringify(r.routes[0]).substring(0,300));})"
    ".catch(e=>console.log('CRASH:',e.message));"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmds)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print("stderr:", err)

# 额外测落马洲场景
print("\n=== Scenario 2: 落马洲口岸到香港立法会 (TDAS 无路网) ===")
cmd2 = (
    'docker exec lugang-ai-plugin timeout 30 node -e "'
    "const m=require('/tmp/tv3/index.js');"
    "m.cb({question:'从落马洲口岸到香港立法会怎么走',language:'zh-CN'})"
    ".then(r=>{console.log('routes count:',r.routes.length);console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus));console.log('error:',r.error);console.log('tips:',r.tips);})"
    ".catch(e=>console.log('CRASH:',e.message));"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd2)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
