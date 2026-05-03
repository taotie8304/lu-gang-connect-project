import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

# 用 geocoder 里的真实坐标测 TDAS
# 落马洲口岸 (22.5144, 114.0683) -> 香港立法会 (22.2802, 114.1662)
tests = [
    ('落马洲口岸(22.5144,114.0683) -> 立法会(22.2802,114.1662)',
     '{"start":{"lat":22.5144,"long":114.0683},"end":{"lat":22.2802,"long":114.1662},"lang":"tc","type":"ST"}'),
    ('中环(22.2819,114.1585) -> 尖沙咀(22.2988,114.1722)',
     '{"start":{"lat":22.2819,"long":114.1585},"end":{"lat":22.2988,"long":114.1722},"lang":"tc","type":"ST"}'),
    ('落马洲口岸(偏移到道路) -> 立法会',
     '{"start":{"lat":22.5100,"long":114.0650},"end":{"lat":22.2802,"long":114.1662},"lang":"tc","type":"ST"}'),
]

for name, body in tests:
    cmd = (
        f'curl -s -m 15 -X POST -H "Content-Type: application/json" '
        f"-d '{body}' "
        f'https://tdas-api.hkemobility.gov.hk/tdas/api/route '
        f'-w "\\nHTTP:%{{http_code}}\\n"'
    )
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    print(f"[{name}]")
    print(f"  {out[:600]}")
    print()

c.close()
