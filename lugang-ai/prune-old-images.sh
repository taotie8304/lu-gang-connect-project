#!/bin/bash

# 鲁港通 - 发版后镜像收尾：只保留「当前运行版」与「回滚目标」两版 lugang-ai 镜像
# 由 deploy-prod.sh 在部署成功后调用，也可手动执行

set -u

cd "$(dirname "$0")" || exit 1

# 鲁港通 - 回滚目标由 deploy-prod.sh 部署成功时写入（/tmp 重启会丢，故持久化到站点目录）
KEEP_ROLLBACK=$(cat .rollback-tag 2>/dev/null || true)
KEEP_CURRENT=$(docker inspect --format='{{.Config.Image}}' lugang-ai-app 2>/dev/null || true)

echo ""
echo -e "\033[1;33m[镜像收尾] 只保留当前运行版与回滚目标\033[0m"
echo "  当前运行版: ${KEEP_CURRENT:-未检测到}"
echo "  回滚目标:   ${KEEP_ROLLBACK:-未记录}"

# 安全阀：任何容器正在引用的镜像一律不删
USED_IMAGE_IDS=$(docker ps -a -q | xargs -r docker inspect --format='{{.Image}}' 2>/dev/null | sort -u)

TAG_LIST=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^ghcr\.io/.*/lugang-ai:' | grep -v ':<none>$' || true)

if [ -z "$TAG_LIST" ]; then
    echo "  未发现 lugang-ai 镜像标签，跳过清理"
else
    echo "$TAG_LIST" | while IFS= read -r ref; do
        [ -z "$ref" ] && continue
        image_id=$(docker inspect --format='{{.Id}}' "$ref" 2>/dev/null || true)
        if [ -z "$image_id" ]; then
            continue
        fi
        if [ -n "$KEEP_CURRENT" ] && [ "$ref" = "$KEEP_CURRENT" ]; then
            echo "  保留(当前运行): $ref"
            continue
        fi
        if [ -n "$KEEP_ROLLBACK" ] && [ "$ref" = "$KEEP_ROLLBACK" ]; then
            echo "  保留(回滚目标): $ref"
            continue
        fi
        if echo "$USED_IMAGE_IDS" | grep -qx "$image_id"; then
            echo "  保留(容器引用): $ref"
            continue
        fi
        echo "  删除: $ref"
        docker rmi "$ref" > /dev/null 2>&1 || echo "    警告: 删除失败（共享层仍被保留镜像引用），已跳过"
    done
fi

docker image prune -f > /dev/null 2>&1 || true

echo "  磁盘: $(df -h / | awk 'NR==2 {print $3" 已用 / "$2"，可用 "$4" ("$5")"}')"
echo -e "\033[1;33m[镜像收尾] 完成\033[0m"
