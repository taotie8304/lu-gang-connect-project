import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 上传新 pkg
sftp = c.open_sftp()
sftp.put(r'D:\lu-gang-connect-project\hk-transport-plugin\dist\hk_transport_assistant.pkg', '/tmp/pkg_v4.pkg')
sftp.close()

# 解压 + 注入探针
setup = (
    'rm -rf /tmp/tv4 && mkdir -p /tmp/tv4 && '
    'cd /tmp/tv4 && unzip -o /tmp/pkg_v4.pkg >/dev/null && '
    'docker cp /tmp/tv4 lugang-ai-plugin:/tmp/tv4'
)
stdin, stdout, stderr = c.exec_command(setup)
stdout.channel.recv_exit_status()

# 实测调用
print("=== Test 1: 中环 → 尖沙咀 ===")
cmd = (
    'docker exec lugang-ai-plugin timeout 60 node -e "'
    "const m=require('/tmp/tv4/index.js');"
    "console.time('call');"
    "m.cb({question:'从中环到尖沙咀怎么走',language:'zh-CN'})"
    ".then(r=>{"
    "  console.timeEnd('call');"
    "  console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus));"
    "  console.log('routes count:',r.routes.length);"
    "  console.log('error:',r.error||'(none)');"
    "  if(r.routes[0]){"
    "    const rt=r.routes[0];"
    "    console.log('--- Route 1:');"
    "    console.log('  id:',rt.id,'totalTime:',rt.totalTime,'min, distance:',rt.totalDistance);"
    "    rt.steps.forEach((s,i)=>console.log('  Step '+(i+1)+':',s.description));"
    "  }"
    "  if(r.routes[1]){"
    "    console.log('--- Route 2 (brief):',r.routes[1].steps[1]&&r.routes[1].steps[1].description);"
    "  }"
    "})"
    ".catch(e=>console.log('ERR:',e.message));"
    '" 2>&1'
)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))

# 测落马洲口岸
print("\n=== Test 2: 落马洲口岸 → 旺角 ===")
cmd2 = (
    'docker exec lugang-ai-plugin timeout 60 node -e "'
    "const m=require('/tmp/tv4/index.js');"
    "m.cb({question:'从落马洲口岸到旺角怎么走',language:'zh-CN'})"
    ".then(r=>{"
    "  console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus));"
    "  console.log('routes:',r.routes.length);"
    "  console.log('error:',r.error||'(none)');"
    "  r.routes.slice(0,2).forEach((rt,i)=>{"
    "    console.log('--- Route '+(i+1)+':','totalTime='+rt.totalTime+'min');"
    "    rt.steps.forEach(s=>console.log('  -',s.description));"
    "  });"
    "})"
    ".catch(e=>console.log('ERR:',e.message));"
    '" 2>&1'
)
stdin, stdout, stderr = c.exec_command(cmd2)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
