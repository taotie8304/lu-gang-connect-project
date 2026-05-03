import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

sftp = c.open_sftp()
local = r'D:\lu-gang-connect-project\hk-transport-plugin\dist\hk_transport_assistant.pkg'
remote = '/tmp/hk_transport_assistant_v2.pkg'
sftp.put(local, remote)
print(f"Uploaded to {remote}")
sftp.close()

# 先在 host 解压，然后 docker cp 进去
extract_cmd = (
    'rm -rf /tmp/test_v2 && mkdir -p /tmp/test_v2 && '
    'cd /tmp/test_v2 && unzip -o /tmp/hk_transport_assistant_v2.pkg 2>&1 | tail -5 && '
    'ls -la /tmp/test_v2/ && '
    'docker cp /tmp/test_v2 lugang-ai-plugin:/tmp/test_v2'
)
stdin, stdout, stderr = c.exec_command(extract_cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print("stderr:", stderr.read().decode('utf-8', errors='replace'))

# 测试 require
print("\n=== Test require in plugin container ===")
test_cmd = (
    'docker exec lugang-ai-plugin node -e "'
    "const m=require('/tmp/test_v2/index.js');"
    "console.log('toolId:',m.toolId);"
    "console.log('cb type:',typeof m.cb);"
    "console.log('IS fallback:',String(m.cb).includes('IIFE bind failed'));"
    '" 2>&1'
)
stdin, stdout, stderr = c.exec_command(test_cmd)
print(stdout.read().decode('utf-8', errors='replace'))

# 调用 cb 并等结果
print("\n=== Call cb with real input ===")
call_cmd = (
    'docker exec lugang-ai-plugin timeout 20 node -e "'
    "const m=require('/tmp/test_v2/index.js');"
    "if(!m.cb){console.log('NO CB!');process.exit(1);}"
    "m.cb({question:'从落马洲口岸到香港立法会',language:'zh-CN'},{systemVar:{},streamResponse:()=>{}})"
    ".then(r=>{console.log('OK result keys:',Object.keys(r||{}));console.log('result.tips:',r && r.tips);console.log('result.metadata:',r && r.metadata);console.log('result.error:',r && r.error);})"
    ".catch(e=>console.log('ERR:',e.message,e.stack && e.stack.substring(0,500)));"
    '" 2>&1'
)
stdin, stdout, stderr = c.exec_command(call_cmd)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
