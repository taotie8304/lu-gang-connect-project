import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

tests = [
    ('裸请求',
     'curl -s -m 30 -o /dev/null -w "HTTP:%{http_code}\\n" https://data.etabus.gov.hk/v1/transport/kmb/route-stop'),
    ('带 UA',
     'curl -s -m 30 -o /dev/null -w "HTTP:%{http_code}\\n" -H "User-Agent: Mozilla/5.0" https://data.etabus.gov.hk/v1/transport/kmb/route-stop'),
    ('带 Accept',
     'curl -s -m 30 -o /dev/null -w "HTTP:%{http_code}\\n" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36" -H "Accept: application/json" https://data.etabus.gov.hk/v1/transport/kmb/route-stop'),
    ('只要前 500 字节（带 Accept-Encoding: gzip）',
     'curl -s -m 30 --compressed -o /dev/null -w "HTTP:%{http_code} size:%{size_download}\\n" -H "User-Agent: Mozilla/5.0" -H "Accept-Encoding: gzip" https://data.etabus.gov.hk/v1/transport/kmb/route-stop'),
    ('对比: /stop 端点',
     'curl -s -m 30 -o /dev/null -w "HTTP:%{http_code} size:%{size_download}\\n" -H "User-Agent: Mozilla/5.0" https://data.etabus.gov.hk/v1/transport/kmb/stop'),
    ('对比: /route 端点',
     'curl -s -m 30 -o /dev/null -w "HTTP:%{http_code} size:%{size_download}\\n" https://data.etabus.gov.hk/v1/transport/kmb/route/'),
]

for name, cmd in tests:
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"[{name}] {out}")

c.close()
