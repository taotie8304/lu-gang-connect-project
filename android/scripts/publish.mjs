// 鲁港通 - 更新源发布：本地产物校验 → 上传服务器 → 双端 sha256 与 HTTP 核验
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REMOTE = 'lugang';
const REMOTE_DIR = '/www/wwwroot/lugang-android-updates';
const PUBLIC_BASE = 'https://www.airscend.com/android/updates';
const RESOLVE = '--resolve www.airscend.com:443:127.0.0.1';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const dist = resolve(readArg('--dist') || join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));

main();

function main() {
  const manifestPath = join(dist, 'latest.json');
  if (!existsSync(manifestPath)) fail('缺少 dist/latest.json，请使用签名构建产物');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const apkName = `lugang-android-${manifest.versionName}-${manifest.versionCode}.apk`;
  const apkPath = join(dist, apkName);
  if (!existsSync(apkPath)) fail(`缺少安装包 ${apkName}`);
  if (!manifest.apkUrl.startsWith(`${PUBLIC_BASE}/`)) fail(`apkUrl 不在更新源目录：${manifest.apkUrl}`);

  const size = statSync(apkPath).size;
  const sha256 = createHash('sha256').update(readFileSync(apkPath)).digest('hex');
  if (size !== manifest.size) fail(`本地体积不一致：${size} vs ${manifest.size}`);
  if (sha256 !== manifest.sha256) fail(`本地 sha256 不一致：${sha256} vs ${manifest.sha256}`);

  const remoteRaw = ssh(`cat ${REMOTE_DIR}/latest.json 2>/dev/null || true`).trim();
  if (remoteRaw) {
    const remote = JSON.parse(remoteRaw);
    if (!force && remote.versionCode >= manifest.versionCode) {
      fail(`服务器已有 versionCode=${remote.versionCode}（本地=${manifest.versionCode}）；回退发布请显式加 --force`);
    }
  }

  console.log(JSON.stringify({
    versionName: manifest.versionName,
    versionCode: manifest.versionCode,
    size,
    sha256
  }, null, 2));
  if (dryRun) {
    console.log('[publish] dry-run：未上传');
    return;
  }

  ssh(`mkdir -p ${REMOTE_DIR}`);
  scp(apkPath, `${REMOTE}:${REMOTE_DIR}/${apkName}`);
  const remoteSha = ssh(`sha256sum ${REMOTE_DIR}/${apkName} | cut -d' ' -f1`).trim();
  if (remoteSha !== sha256) fail(`服务器 sha256 不一致：${remoteSha} vs ${sha256}`);
  scp(manifestPath, `${REMOTE}:${REMOTE_DIR}/latest.json`);

  const manifestCode = ssh(
    `curl -ks -o /dev/null -w '%{http_code}' ${RESOLVE} "${PUBLIC_BASE}/latest.json?ts=$(date +%s)"`
  ).trim();
  if (manifestCode !== '200') fail(`latest.json HTTP ${manifestCode}（期望 200）`);
  const apkCode = ssh(
    `curl -ks -o /dev/null -w '%{http_code}' -r 0-1023 ${RESOLVE} "${PUBLIC_BASE}/${apkName}"`
  ).trim();
  if (apkCode !== '200' && apkCode !== '206') fail(`安装包 HTTP ${apkCode}（期望 200/206）`);

  console.log(JSON.stringify({
    published: true,
    versionName: manifest.versionName,
    versionCode: manifest.versionCode,
    apkName,
    remoteSha
  }, null, 2));
}

function readArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function ssh(command) {
  return execFileSync('ssh', [REMOTE, command], { encoding: 'utf8' });
}

function scp(localPath, remotePath) {
  execFileSync('scp', [localPath, remotePath], { encoding: 'utf8' });
}

function fail(message) {
  console.error(`[publish] ${message}`);
  process.exit(1);
}
