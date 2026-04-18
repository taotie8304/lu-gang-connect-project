// 鲁港通 - 测试自动更新功能
// 这个脚本用于验证自动更新模块是否能正常工作

const testAutoUpdate = async () => {
  console.log('开始测试自动更新功能...\n');

  // 测试 1: 页面爬取
  console.log('测试 1: 页面爬取功能');
  try {
    const { scrapeDatasetPage } = await import('./lugang-ai/packages/service/core/dataset/autoUpdate/scraper.ts');
    
    // 使用一个示例 URL 测试
    const testUrl = 'https://data.gov.hk/tc-data/dataset/hk-fehd-fehdlbs-food-licence';
    console.log(`测试 URL: ${testUrl}`);
    
    const result = await scrapeDatasetPage(testUrl, 'csv');
    console.log(`✓ 爬取成功，找到 ${result.files.length} 个文件`);
    if (result.files.length > 0) {
      console.log(`  示例文件: ${result.files[0].fileName}`);
    }
  } catch (error) {
    console.log(`✗ 爬取失败: ${error.message}`);
  }
  console.log('');

  // 测试 2: 文件名检测
  console.log('测试 2: 文件名年份检测');
  try {
    const { detectNewFile } = await import('./lugang-ai/packages/service/core/dataset/autoUpdate/detector.ts');
    
    const testFiles = [
      { fileName: 'food-licence-2025-26.csv', fileUrl: 'http://example.com/file.csv' },
      { fileName: 'food-licence-2023-24.csv', fileUrl: 'http://example.com/file2.csv' }
    ];
    
    const result = detectNewFile(
      testFiles,
      { yearPattern: [], checkUpdateTime: true, detailPageCheck: false },
      new Date('2024-01-01')
    );
    
    console.log(`✓ 检测结果: ${result.isNewFile ? '发现新文件' : '无新文件'}`);
    console.log(`  原因: ${result.reason}`);
    if (result.matchedFile) {
      console.log(`  匹配文件: ${result.matchedFile.fileName}`);
    }
  } catch (error) {
    console.log(`✗ 检测失败: ${error.message}`);
  }
  console.log('');

  // 测试 3: 日期解析
  console.log('测试 3: 日期解析功能');
  const testDates = [
    '2025-01-15',
    '15/01/2025',
    '15-01-2025',
    '2025/01/15'
  ];
  
  testDates.forEach(dateStr => {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        console.log(`✓ "${dateStr}" -> ${date.toISOString().split('T')[0]}`);
      } else {
        console.log(`✗ "${dateStr}" 解析失败`);
      }
    } catch (error) {
      console.log(`✗ "${dateStr}" 解析失败: ${error.message}`);
    }
  });
  console.log('');

  console.log('测试完成！');
  console.log('\n注意事项：');
  console.log('1. 完整功能需要在 Next.js 应用中运行');
  console.log('2. 需要 MongoDB 连接才能测试数据库操作');
  console.log('3. 定时任务会在应用启动时自动启动（每月1号凌晨2点）');
};

// 运行测试
testAutoUpdate().catch(console.error);
