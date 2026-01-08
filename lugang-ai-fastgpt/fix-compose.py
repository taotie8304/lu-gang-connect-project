#!/usr/bin/env python3
"""
快速修复 docker-compose.yml 文件
移除 lugang-ai 服务对 minio 的依赖
"""

import re
from datetime import datetime

# 读取文件
with open('/www/wwwroot/lugang-ai-fastgpt/docker-compose.yml', 'r', encoding='utf-8') as f:
    content = f.read()

# 备份原文件
backup_file = f'/www/wwwroot/lugang-ai-fastgpt/docker-compose.yml.backup.{datetime.now().strftime("%Y%m%d_%H%M%S")}'
with open(backup_file, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"✓ 已备份原文件到: {backup_file}")

# 修复 depends_on 部分
# 查找 lugang-ai 服务的 depends_on 部分并替换
pattern = r'(  lugang-ai:.*?depends_on:\s*\n)(.*?)(    env_file:)'
replacement = r'\1      - mongo\n      - pg\n      - redis\n      # - minio  # 已禁用可选服务\n\3'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# 写入修改后的文件
with open('/www/wwwroot/lugang-ai-fastgpt/docker-compose.yml', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✓ 已修复 docker-compose.yml")
print("\n修改后的 depends_on 部分:")
print("-" * 50)

# 显示修改后的 depends_on 部分
match = re.search(r'depends_on:.*?env_file:', new_content, re.DOTALL)
if match:
    print(match.group(0))

print("-" * 50)
print("\n下一步操作:")
print("1. docker-compose down")
print("2. docker-compose up -d")
print("3. docker-compose ps")
