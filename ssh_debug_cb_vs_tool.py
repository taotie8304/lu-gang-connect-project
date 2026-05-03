import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

cmd = (
    'docker exec lugang-ai-plugin timeout 30 node -e "'
    "const fs=require('fs');"
    "let js=fs.readFileSync('/tmp/tv3/index.js','utf-8');"
    "js = js.replace('// === Plugin metadata', 'globalThis.__probe=__hkPlugin;// === Plugin metadata');"
    "fs.writeFileSync('/tmp/probe2.js',js);"
    "const m=require('/tmp/probe2.js');"
    "console.log('m.cb === __probe.tool:', m.cb === globalThis.__probe.tool);"
    "console.log('m.cb === __probe.default.cb:', m.cb === globalThis.__probe.default.cb);"
    "console.log('__probe.tool === __probe.default.cb:', globalThis.__probe.tool === globalThis.__probe.default.cb);"
    "console.log('m.cb.toString first 300:', m.cb.toString().substring(0,300));"
    # 测 cb 与 tool 行为
    "console.log('\\n--- calling m.cb ---');"
    "m.cb({question:'从中环到尖沙咀怎么走',language:'zh-CN'}).then(r=>{"
    "  console.log('cb apiStatus:',JSON.stringify(r.metadata.apiStatus));"
    "  console.log('cb routes:',r.routes.length);"
    "});"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print("stderr:", err)

c.close()
