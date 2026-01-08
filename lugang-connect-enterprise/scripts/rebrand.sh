#!/bin/bash
# 鲁港通企业版品牌替换脚本
# 将One API的标识替换为鲁港通企业版

echo "开始品牌替换..."

# 替换前端文件中的品牌标识
find ./web -type f -name "*.js" -exec sed -i 's/One API/鲁港通企业版/g' {} \;
find ./web -type f -name "*.js" -exec sed -i 's/one-api/lugang-enterprise/g' {} \;
find ./web -type f -name "*.json" -exec sed -i 's/One API/鲁港通企业版/g' {} \;

# 替换HTML文件
find ./web -type f -name "*.html" -exec sed -i 's/One API/鲁港通企业版/g' {} \;

echo "品牌替换完成!"
