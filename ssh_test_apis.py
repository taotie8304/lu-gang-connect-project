import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

tests = [
    # TDAS 路径规划（插件使用）
    ('TDAS route (POST)',
     'curl -s -m 15 -X POST -H "Content-Type: application/json" '
     '-d \'{"start":{"lat":22.5126,"long":114.0665},"end":{"lat":22.2792,"long":114.1726},"lang":"tc","type":"ST"}\' '
     'https://tdas-api.hkemobility.gov.hk/tdas/api/route -w "\\nHTTP:%{http_code}\\n" 2>&1 | head -c 600'),
    # KMB 路线列表（列表里提到）
    ('KMB routes', 'curl -s -m 10 https://data.etabus.gov.hk/v1/transport/kmb/route/ -w "\\nHTTP:%{http_code}\\n" -o /dev/null 2>&1'),
    # CTB 路线
    ('CTB routes', 'curl -s -m 10 https://rt.data.gov.hk/v2/transport/citybus/route/CTB -w "\\nHTTP:%{http_code}\\n" -o /dev/null 2>&1'),
    # GMB last-update
    ('GMB last-update', 'curl -s -m 10 https://data.etagmb.gov.hk/last-update/ -w "\\nHTTP:%{http_code}\\n" 2>&1 | head -c 300'),
    # MTR
    ('MTR schedule', 'curl -s -m 10 https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php -w "\\nHTTP:%{http_code}\\n" -o /dev/null 2>&1'),
    # 静态资料
    ('Static JSON_BUS', 'curl -s -m 10 https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json -w "\\nHTTP:%{http_code}\\n" -o /dev/null 2>&1'),
]

print("=== 从【宿主机】直接测试 ===")
for name, cmd in tests:
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"[{name}]")
    print(f"  {out[:500]}")

print("\n\n=== 从【plugin 容器内】测试（与插件运行环境一致）===")
for name, cmd in tests:
    wrap = 'docker exec lugang-ai-plugin sh -c "' + cmd.replace('"', '\\"') + '"'
    stdin, stdout, stderr = c.exec_command(wrap)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"[{name}]")
    print(f"  {out[:500]}")

c.close()
