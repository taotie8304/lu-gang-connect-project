import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 1. 检查 MongoDB 中存储的 system plugins
print("=== MongoDB: system plugins ===")
stdin, stdout, stderr = c.exec_command(
    'docker exec lugang-ai-mongo mongosh fastgpt --quiet --eval '
    '"db.plugintags.find({}).toArray()" 2>&1 | head -c 3000'
)
print(stdout.read().decode('utf-8', errors='replace'))

# 2. 检查插件服务内存中加载的工具
print("\n=== Plugin service: loaded tools via API ===")
stdin2, stdout2, stderr2 = c.exec_command(
    'curl -s -H "Authorization: Bearer lugangplugin2025" '
    'http://localhost:8088/tools 2>&1 | head -c 3000'
)
print(stdout2.read().decode('utf-8', errors='replace'))

# 3. 检查 MinIO 中 .js 文件内容末尾（查看 toolId）
print("\n=== Plugin JS tail in MinIO ===")
stdin3, stdout3, stderr3 = c.exec_command(
    'docker exec lugang-ai-plugin node -e "'
    "const fs=require('fs');"
    "const path='/tmp/fastgpt-plugin/pkgs';"
    "try{const files=fs.readdirSync(path);console.log('files:',files);}catch(e){console.log('no pkgs dir:',e.message);}"
    '" 2>&1'
)
print(stdout3.read().decode('utf-8', errors='replace'))

# 4. 查找 MinIO 中的插件文件
print("\n=== MinIO plugin files ===")
stdin4, stdout4, stderr4 = c.exec_command(
    'docker exec lugang-ai-plugin node -e "'
    "const {S3Client,ListObjectsV2Command}=require('@aws-sdk/client-s3');"
    "const c=new S3Client({endpoint:'http://minio:9000',region:'us-east-1',credentials:{accessKeyId:'minioadmin',secretAccessKey:'minioadmin'},forcePathStyle:true});"
    "c.send(new ListObjectsV2Command({Bucket:'lugang-private',Prefix:'system/plugin/tools'})).then(r=>console.log(JSON.stringify(r.Contents))).catch(e=>console.log(e.message));"
    '" 2>&1'
)
print(stdout4.read().decode('utf-8', errors='replace'))

c.close()
