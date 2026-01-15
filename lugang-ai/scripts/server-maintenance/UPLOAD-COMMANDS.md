# 脚本上传命令

请在服务器上依次执行以下命令上传脚本。

## 前置步骤（已完成）
```bash
mkdir -p /www/wwwroot/lugang-ai/scripts/server-maintenance
mkdir -p /www/wwwroot/backups
```

## 上传脚本

### 1. 上传 00-verify-backup.sh
复制以下内容到服务器终端执行：

```bash
cat > /www/wwwroot/lugang-ai/scripts/server-maintenance/00-verify-backup.sh << 'SCRIPT_EOF'
#!/bin/bash

# ===== 鲁港通 - 备份验证脚本 =====
# 验证备份是否完整可用
# 
# 使用方法: 
#   chmod +x 00-verify-backup.sh
#   ./00-verify-backup.sh [备份目录名]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BACKUP_ROOT="/www/wwwroot/backups"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        鲁港通 - 备份验证脚本 v1.0                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# 获取备份目录
if [ -n "$1" ]; then
    BACKUP_DIR="${BACKUP_ROOT}/$1"
else
    # 列出所有备份
    echo "可用备份:"
    ls -la "${BACKUP_ROOT}" 2>/dev/null | grep -E "lugang-(backup|final)" || echo "无备份"
    echo ""
    read -p "请输入要验证的备份目录名称: " BACKUP_NAME
    BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}错误: 备份目录不存在: ${BACKUP_DIR}${NC}"
    exit 1
fi

echo -e "${BLUE}验证备份: ${BACKUP_DIR}${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_pass() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASS_COUNT++))
}

check_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((FAIL_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARN_COUNT++))
}

# ===== 1. 检查 MongoDB 备份 =====
echo -e "${YELLOW}[1/5] 检查 MongoDB 备份...${NC}"
if [ -d "${BACKUP_DIR}/mongodb/dump" ]; then
    DB_COUNT=$(find "${BACKUP_DIR}/mongodb/dump" -mindepth 1 -maxdepth 1 -type d | wc -l)
    if [ "$DB_COUNT" -gt 0 ]; then
        check_pass "MongoDB 备份存在 (${DB_COUNT} 个数据库)"
        if [ -d "${BACKUP_DIR}/mongodb/dump/lugang_ai" ]; then
            COLLECTION_COUNT=$(find "${BACKUP_DIR}/mongodb/dump/lugang_ai" -name "*.bson" | wc -l)
            check_pass "lugang_ai 数据库存在 (${COLLECTION_COUNT} 个集合)"
        else
            check_warn "未找到 lugang_ai 数据库"
        fi
    else
        check_fail "MongoDB 备份目录为空"
    fi
else
    check_fail "MongoDB 备份不存在"
fi
echo ""

# ===== 2. 检查 PostgreSQL 备份 =====
echo -e "${YELLOW}[2/5] 检查 PostgreSQL 备份...${NC}"
if [ -f "${BACKUP_DIR}/postgresql/all_databases.sql" ]; then
    PG_SIZE=$(du -sh "${BACKUP_DIR}/postgresql/all_databases.sql" | cut -f1)
    PG_LINES=$(wc -l < "${BACKUP_DIR}/postgresql/all_databases.sql")
    if [ "$PG_LINES" -gt 100 ]; then
        check_pass "PostgreSQL 备份存在 (${PG_SIZE}, ${PG_LINES} 行)"
        if grep -q "CREATE TABLE" "${BACKUP_DIR}/postgresql/all_databases.sql"; then
            check_pass "PostgreSQL 备份包含表结构"
        else
            check_warn "PostgreSQL 备份可能不完整（未找到表结构）"
        fi
    else
        check_fail "PostgreSQL 备份文件过小 (${PG_LINES} 行)"
    fi
else
    check_fail "PostgreSQL 备份不存在"
fi
echo ""

# ===== 3. 检查配置文件备份 =====
echo -e "${YELLOW}[3/5] 检查配置文件备份...${NC}"
if [ -d "${BACKUP_DIR}/configs" ]; then
    if [ -f "${BACKUP_DIR}/configs/.env.local" ]; then
        check_pass ".env.local 配置文件存在"
    else
        check_warn ".env.local 配置文件不存在"
    fi
    CONFIG_COUNT=$(find "${BACKUP_DIR}/configs" -type f | wc -l)
    check_pass "配置文件目录存在 (${CONFIG_COUNT} 个文件)"
else
    check_warn "配置文件备份不存在"
fi
echo ""

# ===== 4. 检查 Docker 镜像备份 =====
echo -e "${YELLOW}[4/5] 检查 Docker 镜像备份...${NC}"
if [ -d "${BACKUP_DIR}/docker-images" ]; then
    if [ -f "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" ]; then
        IMAGE_SIZE=$(du -sh "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" | cut -f1)
        check_pass "Docker 镜像备份存在 (${IMAGE_SIZE})"
        if gzip -t "${BACKUP_DIR}/docker-images/lugang-ai-app.tar.gz" 2>/dev/null; then
            check_pass "Docker 镜像文件完整性验证通过"
        else
            check_fail "Docker 镜像文件损坏"
        fi
        if [ -f "${BACKUP_DIR}/docker-images/image-info.txt" ]; then
            ORIGINAL_IMAGE=$(head -1 "${BACKUP_DIR}/docker-images/image-info.txt")
            check_pass "镜像信息文件存在: ${ORIGINAL_IMAGE}"
        fi
    else
        check_warn "Docker 镜像备份不存在（回滚时需要重新构建）"
    fi
else
    check_warn "Docker 镜像目录不存在"
fi
echo ""

# ===== 5. 检查恢复脚本 =====
echo -e "${YELLOW}[5/5] 检查恢复脚本...${NC}"
if [ -f "${BACKUP_DIR}/restore.sh" ]; then
    if [ -x "${BACKUP_DIR}/restore.sh" ]; then
        check_pass "恢复脚本存在且可执行"
    else
        check_warn "恢复脚本存在但不可执行"
    fi
else
    check_warn "恢复脚本不存在"
fi

if [ -f "${BACKUP_DIR}/BACKUP_INFO.txt" ]; then
    check_pass "备份信息文件存在"
    echo ""
    echo -e "${CYAN}备份信息:${NC}"
    head -15 "${BACKUP_DIR}/BACKUP_INFO.txt" | sed 's/^/  /'
fi
echo ""

# ===== 显示验证结果 =====
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  验证完成                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "验证结果:"
echo -e "  ${GREEN}通过: ${PASS_COUNT}${NC}"
echo -e "  ${RED}失败: ${FAIL_COUNT}${NC}"
echo -e "  ${YELLOW}警告: ${WARN_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    if [ $WARN_COUNT -eq 0 ]; then
        echo -e "${GREEN}✓ 备份完整，可以安全回滚！${NC}"
    else
        echo -e "${YELLOW}⚠ 备份基本完整，但有 ${WARN_COUNT} 个警告${NC}"
    fi
else
    echo -e "${RED}✗ 备份不完整，有 ${FAIL_COUNT} 个关键项失败！${NC}"
fi
echo ""
echo -e "${BLUE}备份总大小: $(du -sh ${BACKUP_DIR} | cut -f1)${NC}"
SCRIPT_EOF
```

---

由于内容太长，我将为你生成一个更简单的方式。请在服务器上执行以下命令来下载脚本：
