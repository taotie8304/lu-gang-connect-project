// 鲁港通 - 测试香港政府 CKAN API
const axios = require('axios');

const datasetId = 'edb_rcd_1633401226600_10690';

async function testCkanApi() {
  console.log('========== 测试 CKAN API ==========');
  console.log('数据集 ID:', datasetId);
  console.log('');

  try {
    // 1. 调用 CKAN API 获取数据集元数据
    const ckanUrl = `https://data.gov.hk/tc-data/api/3/action/package_show?id=${datasetId}`;
    console.log('CKAN API URL:', ckanUrl);
    console.log('');

    const response = await axios.get(ckanUrl);

    if (!response.data.success) {
      console.error('❌ CKAN API 调用失败');
      return;
    }

    const packageData = response.data.result;
    console.log('✅ CKAN API 调用成功！');
    console.log('');
    console.log('数据集名称:', packageData.title || packageData.name);
    console.log('数据集描述:', (packageData.notes || '').substring(0, 100));
    console.log('资源数量:', packageData.resources?.length || 0);
    console.log('');

    // 2. 查找资源
    const resources = packageData.resources || [];
    if (resources.length === 0) {
      console.error('❌ 数据集没有资源');
      return;
    }

    console.log('========== 资源列表 ==========');
    resources.forEach((resource, index) => {
      console.log(`资源 ${index + 1}:`);
      console.log('  名称:', resource.name || resource.description);
      console.log('  格式:', resource.format);
      console.log('  URL:', resource.url);
      console.log('');
    });

    // 3. 选择第一个资源并构建 v2/filter API
    const selectedResource = resources[0];
    const resourceUrl = selectedResource.url;

    const filterQuery = {
      resource: resourceUrl,
      section: 1,
      format: 'json'
    };

    const apiEndpoint = `https://api.data.gov.hk/v2/filter?q=${encodeURIComponent(
      JSON.stringify(filterQuery)
    )}`;

    console.log('========== 数据筛选 API ==========');
    console.log('API 端点:', apiEndpoint);
    console.log('');

    // 4. 调用 v2/filter API 获取数据
    console.log('正在下载数据...');
    const dataResponse = await axios.get(apiEndpoint);

    console.log('✅ 数据下载成功！');
    console.log('');
    console.log('数据类型:', typeof dataResponse.data);

    if (Array.isArray(dataResponse.data)) {
      console.log('数组长度:', dataResponse.data.length);
      console.log('');
      console.log('前 3 条数据:');
      console.log(JSON.stringify(dataResponse.data.slice(0, 3), null, 2));
    } else {
      console.log('数据:', JSON.stringify(dataResponse.data, null, 2).substring(0, 500));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
    }
  }
}

testCkanApi();
