// 鲁港通 - 测试夹具读取助手（fixtures 目录按 import.meta.url 定位，与 CWD 无关）
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

/** 读取 fixtures 目录下的原始字节文件 */
export const fixture = (name: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)));

/** 读取 fixtures 目录下已转码为 UTF-8 的文本文件 */
export const fixtureText = (name: string): string => fixture(name).toString('utf8');
