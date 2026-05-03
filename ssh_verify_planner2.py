import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

sftp = c.open_sftp()
sftp.put(r'D:\lu-gang-connect-project\hk-transport-plugin\dist\hk_transport_assistant.pkg', '/tmp/pkg_v6.pkg')
sftp.close()

setup = (
    'rm -rf /tmp/tv6 && mkdir -p /tmp/tv6 && '
    'cd /tmp/tv6 && unzip -o /tmp/pkg_v6.pkg >/dev/null && '
    'docker cp /tmp/tv6 lugang-ai-plugin:/tmp/tv6'
)
stdin, stdout, stderr = c.exec_command(setup)
stdout.channel.recv_exit_status()

# 第一次调用（触发数据加载）
print("=== Call 1: 中环 → 尖沙咀 (cold start) ===")
cmd = (
    'docker exec lugang-ai-plugin timeout 90 node -e "'
    "const m=require('/tmp/tv6/index.js');"
    "console.time('cold');"
    "m.cb({question:'从中环到尖沙咀怎么走',language:'zh-CN'})"
    ".then(r=>{"
    "  console.timeEnd('cold');"
    "  console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus,null,2));"
    "  console.log('routes:',r.routes.length);"
    "  console.log('error:',r.error||'(none)');"
    "  console.log('tips:',JSON.stringify(r.tips,null,2));"
    "  r.routes.slice(0,3).forEach((rt,i)=>{"
    "    console.log('--- Route '+(i+1)+':',rt.id,'totalTime='+rt.totalTime+'min','dist='+rt.totalDistance);"
    "    rt.steps.forEach(s=>console.log('  ['+s.type+']',s.description));"
    "  });"
    "})"
    ".catch(e=>console.log('ERR:',e.message));"
    '" 2>&1'
)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
