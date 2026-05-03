import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 从 MinIO 下载 index.js 并看尾部 2000 字节
print("=== 当前 MinIO 中新插件 index.js 尾部（看 exports.tool 是否挂上去）===")
cmd = (
    'docker exec lugang-ai-minio sh -c "'
    'mc alias set local http://localhost:9000 minioadmin minioadmin >/dev/null 2>&1; '
    'mc cat local/lugang-private/system/plugin/tools/hk_transport_assistant.js 2>/dev/null | tail -c 3000"'
)
stdin, stdout, stderr = c.exec_command(cmd)
tail = stdout.read().decode('utf-8', errors='replace')
print(tail)

# 在 plugin 容器里直接 require 测试，看看 exports.tool 是否存在
print("\n=== 在插件容器内实测 index.js 的 exports.tool ===")
cmd2 = (
    'docker exec lugang-ai-minio sh -c "'
    'mc cat local/lugang-private/system/plugin/tools/hk_transport_assistant.js 2>/dev/null > /tmp/test.js" && '
    'docker cp lugang-ai-minio:/tmp/test.js /tmp/test_idx.js && '
    'docker cp /tmp/test_idx.js lugang-ai-plugin:/tmp/test_idx.js && '
    'docker exec lugang-ai-plugin node -e "'
    "const m=require('/tmp/test_idx');"
    "console.log('toolId:',m.toolId);"
    "console.log('cb type:',typeof m.cb);"
    "console.log('cb name:',m.cb && m.cb.name);"
    "console.log('keys:',Object.keys(m));"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd2)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err: print("STDERR:", err)

c.close()
