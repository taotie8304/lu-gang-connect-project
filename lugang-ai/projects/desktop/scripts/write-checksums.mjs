// 鲁港通 - 生成更新源校验和清单 SHA256SUMS.txt（安装包 / blockmap / latest.yml）
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'D:/lugang-desktop-build');
const latest = await readFile(path.join(dir, 'latest.yml'), 'utf8');
const version = /^version:\s*(\S+)/m.exec(latest)?.[1];
if (!version) {
  throw new Error(`latest.yml 缺少 version 字段：${path.join(dir, 'latest.yml')}`);
}

const targets = [
  `lugang-desktop-${version}-setup.exe`,
  `lugang-desktop-${version}-setup.exe.blockmap`,
  'latest.yml'
];

const lines = [];
for (const name of targets) {
  const content = await readFile(path.join(dir, name));
  lines.push(`${createHash('sha256').update(content).digest('hex')}  ${name}`);
}

const output = path.join(dir, 'SHA256SUMS.txt');
await writeFile(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`${output} (${version})`);
lines.forEach((line) => console.log(line));
