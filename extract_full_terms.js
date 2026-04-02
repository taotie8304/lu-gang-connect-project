// 提取完整的使用条款内容
const fs = require('fs');

const content = fs.readFileSync('./lugang-ai/packages/global/support/systemContent/constant.ts', 'utf8');

// 找到 termsOfUse 的 defaultContent 开始位置
const startMarker = '[SystemContentKeyEnum.termsOfUse]: {';
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
  console.error('找不到 termsOfUse 定义');
  process.exit(1);
}

// 找到 defaultContent 的开始
const contentStart = content.indexOf('defaultContent: `', startIndex) + 'defaultContent: `'.length;

// 找到下一个 ` 后面跟着换行和空格然后是 }
// 这是 defaultContent 的结束标记
let contentEnd = contentStart;
let backtickCount = 0;
for (let i = contentStart; i < content.length; i++) {
  if (content[i] === '`') {
    // 检查这个反引号后面是否是结束标记
    const afterBacktick = content.substring(i + 1, i + 10);
    if (afterBacktick.match(/^\s*}/)) {
      contentEnd = i;
      break;
    }
  }
}

const termsContent = content.substring(contentStart, contentEnd);

console.log('提取的内容长度:', termsContent.length, '字符');
console.log('内容开始:', termsContent.substring(0, 100));
console.log('内容结束:', termsContent.substring(termsContent.length - 100));

// 保存到文件
fs.writeFileSync('terms_full_content.txt', termsContent, 'utf8');
console.log('\n完整内容已保存到 terms_full_content.txt');
