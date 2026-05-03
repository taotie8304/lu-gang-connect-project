import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 插件是 IIFE 格式，__hkPlugin 全局可见。从中取内部函数测试
cmd = (
    'docker exec lugang-ai-plugin timeout 30 node -e "'
    "require('/tmp/tv3/index.js');"
    "console.log('globals:', typeof __hkPlugin);"
    "console.log('keys:', Object.keys(globalThis).filter(k=>k.includes('hk')));"
    "if(typeof __hkPlugin!=='undefined'){console.log('__hkPlugin keys:',Object.keys(__hkPlugin));}"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd)
print("=== Probe __hkPlugin exposure ===")
print(stdout.read().decode('utf-8', errors='replace'))

# 直接在 index.js 里访问内部状态 - 用 Node 的 require 后 IIFE 的 var __hkPlugin 应该在模块的顶层作用域
cmd2 = (
    'docker exec lugang-ai-plugin timeout 30 node -e "'
    # 读取文件内容，注入探针
    "const fs=require('fs');"
    "let js=fs.readFileSync('/tmp/tv3/index.js','utf-8');"
    # 在 IIFE 结尾的 module.exports = {...} 之前插入探针
    "js = js.replace('// === Plugin metadata', 'globalThis.__probe=__hkPlugin;// === Plugin metadata');"
    "fs.writeFileSync('/tmp/probe.js',js);"
    "require('/tmp/probe.js');"
    "console.log('probe keys:', Object.keys(globalThis.__probe||{}));"
    "if(globalThis.__probe && globalThis.__probe.tool){"
    "  console.log('calling tool directly...');"
    "  globalThis.__probe.tool({question:'从中环到尖沙咀怎么走',language:'zh-CN'}).then(r=>{"
    "    console.log('apiStatus:',JSON.stringify(r.metadata.apiStatus));"
    "    console.log('routes:',r.routes.length);"
    "    console.log('error:',r.error);"
    "  }).catch(e=>console.log('ERR:',e.message,e.stack&&e.stack.substring(0,400)));"
    "}"
    '"'
)
stdin, stdout, stderr = c.exec_command(cmd2)
print("\n=== Direct call via probe ===")
print(stdout.read().decode('utf-8', errors='replace'))
err = stderr.read().decode('utf-8', errors='replace')
if err.strip(): print("stderr:", err)

c.close()
