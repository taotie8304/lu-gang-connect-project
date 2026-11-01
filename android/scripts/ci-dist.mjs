// 鲁港通 - CI 产物整理：校验版本号规则、重命名 APK、签名构建时生成更新清单
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const props = readProperties(join(root, 'version.properties'));
const versionName = props.versionName || '';
const versionCode = Number(props.versionCode || 0);
const changelog = props.changelog || '';
const expected = expectedVersionCode(versionName);

if (!versionName || !Number.isInteger(versionCode) || versionCode <= 0) {
  fail(`version.properties 的 versionName/versionCode 不合法：${versionName} / ${props.versionCode}`);
}
if (expected === null || expected !== versionCode) {
  fail(`versionCode(${versionCode}) 与 versionName(${versionName}) 不匹配，按规则应为 ${expected}`);
}

const releaseApk = join(root, 'app/build/outputs/apk/release/app-release.apk');
const debugApk = join(root, 'app/build/outputs/apk/debug/app-debug.apk');
const signed = existsSync(releaseApk);
const source = signed ? releaseApk : debugApk;
if (!existsSync(source)) fail('未找到构建产物 APK');

const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });
const fileName = `lugang-android-${versionName}-${versionCode}.apk`;
const target = join(distDir, fileName);
copyFileSync(source, target);

const sha256 = sha256File(target);
const size = statSync(target).size;
if (signed) {
  const manifest = {
    versionCode,
    versionName,
    apkUrl: `https://www.airscend.com/android/updates/${fileName}`,
    sha256,
    size,
    changelog,
    publishedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  };
  writeFileSync(join(distDir, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}
console.log(JSON.stringify({ signed, fileName, sha256, size }, null, 2));

function expectedVersionCode(name) {
  const parts = name.split('.');
  if (parts.length !== 3) return null;
  const nums = parts.map((part) => (/^\d{1,2}$/.test(part) ? Number(part) : NaN));
  if (nums.some((n) => Number.isNaN(n))) return null;
  return nums[0] * 10000 + nums[1] * 100 + nums[2];
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function readProperties(path) {
  const result = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

function fail(message) {
  console.error(`[ci-dist] ${message}`);
  process.exit(1);
}
