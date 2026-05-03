import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 直接探测 planner
cmd = (
    'docker exec lugang-ai-plugin timeout 90 node -e "'
    "const fs=require('fs');"
    "let js=fs.readFileSync('/tmp/tv4/index.js','utf-8');"
    # 把 planPublicTransit 和 loadKMBIndex 暴露到 __hkPlugin
    "js = js.replace('// === Plugin metadata', 'globalThis.__probe=__hkPlugin;// === Plugin metadata');"
    "fs.writeFileSync('/tmp/probe4.js',js);"
    "require('/tmp/probe4.js');"
    "console.log('probe keys:', Object.keys(globalThis.__probe));"
    # planner 没显式 export, 得通过 tool 调用观察
    # 改用网络 fetch 测试底层 API
    "(async()=>{"
    "  console.log('Testing fetchKMBStops...');"
    "  console.time('stops');"
    "  const r1=await fetch('https://data.etabus.gov.hk/v1/transport/kmb/stop');"
    "  console.log('  status:',r1.status);"
    "  const d1=await r1.json();"
    "  console.timeEnd('stops');"
    "  console.log('  stops count:',d1.data&&d1.data.length);"
    "  console.log('Testing fetchKMBRouteStops...');"
    "  console.time('rstops');"
    "  const r2=await fetch('https://data.etabus.gov.hk/v1/transport/kmb/route-stop');"
    "  console.log('  status:',r2.status);"
    "  const d2=await r2.json();"
    "  console.timeEnd('rstops');"
    "  console.log('  route-stops count:',d2.data&&d2.data.length);"
    "  console.log('  first route-stop:',JSON.stringify(d2.data&&d2.data[0]));"
    "})().catch(e=>console.log('ERR:',e.message));"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print("stderr:", err[:500])

c.close()
