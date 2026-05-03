import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('156.225.30.134', 22, 'root', 'Huijin8304*')

sftp = c.open_sftp()
print("上传最新 .pkg ...")
sftp.put(r'D:\lu-gang-connect-project\hk-transport-plugin\dist\hk_transport_assistant.pkg', '/tmp/pkg_mm.pkg')
sftp.close()

# 部署到容器
setup = (
    'rm -rf /tmp/tmm && mkdir -p /tmp/tmm && '
    'cd /tmp/tmm && unzip -o /tmp/pkg_mm.pkg >/dev/null && '
    'docker exec lugang-ai-plugin rm -rf /tmp/tmm && '
    'docker cp /tmp/tmm lugang-ai-plugin:/tmp/'
)
stdin, stdout, stderr = c.exec_command(setup)
stdout.channel.recv_exit_status()
print("已解压到容器")

# 写入测试脚本到容器（通过宿主 /tmp）
test_js = r"""
const m = require('/tmp/tmm/index.js');

const cases = [
  ['从中环到尖沙咀怎么走', '中环→尖沙咀（过海）'],
  ['旺角到铜锣湾', '旺角→铜锣湾（跨区）'],
  ['从屯门到沙田', '屯门→沙田（新界）'],
  ['从落马洲口岸到香港立法会怎么走', '落马洲→立法会（过境）'],
];

(async () => {
  for (const [q, label] of cases) {
    console.log('\n==== ' + label + ': ' + q + ' ====');
    try {
      console.time('elapsed');
      const r = await m.cb({ question: q, language: 'zh-CN' });
      console.timeEnd('elapsed');
      console.log('apiStatus:', JSON.stringify(r.metadata.apiStatus));
      console.log('routes:', r.routes.length, '| error:', r.error || '(none)');
      console.log('tips:');
      (r.tips || []).forEach(t => console.log('  -', t));
      r.routes.slice(0, 5).forEach((rt, i) => {
        console.log('--- Route ' + (i + 1) + ':', rt.id, '| time=' + rt.totalTime + 'min',
          '| dist=' + rt.totalDistance, '| cost=HK$' + rt.estimatedCost);
        rt.steps.forEach(s => console.log('    [' + s.type + ']', s.description));
      });
    } catch (e) {
      console.log('ERR:', e.message);
    }
  }
})();
"""

# 写到宿主 /tmp，然后 docker cp 进容器
with open('ssh_test_mm.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(test_js)

sftp = c.open_sftp()
sftp.put('ssh_test_mm.js', '/tmp/test_mm.js')
sftp.close()

stdin, stdout, stderr = c.exec_command('docker cp /tmp/test_mm.js lugang-ai-plugin:/tmp/test_mm.js')
stdout.channel.recv_exit_status()

stdin, stdout, stderr = c.exec_command(
    'docker exec lugang-ai-plugin timeout 180 node /tmp/test_mm.js 2>&1'
)
print(stdout.read().decode('utf-8', errors='replace'))

c.close()
