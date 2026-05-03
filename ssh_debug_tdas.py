import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 用 node fetch 直接测试 TDAS（容器内 Node 22）
cmd = (
    'docker exec lugang-ai-plugin timeout 20 node -e "'
    "(async()=>{"
    "  const r = await fetch('https://tdas-api.hkemobility.gov.hk/tdas/api/route',{"
    "    method:'POST',"
    "    headers:{'Content-Type':'application/json'},"
    "    body: JSON.stringify({start:{lat:22.2819,long:114.1585},end:{lat:22.2988,long:114.1722},lang:'tc',type:'ST'})"
    "  });"
    "  console.log('status:', r.status);"
    "  const t = await r.text();"
    "  console.log('body first 600:', t.substring(0,600));"
    "})().catch(e=>console.log('ERR:',e.message));"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print("stderr:", err)

c.close()
