import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 看完整 docker logs
stdin, stdout, stderr = c.exec_command('docker logs lugang-ai-plugin --tail 60')
out = stdout.read().decode('utf-8', errors='replace')
print(out)

c.close()
