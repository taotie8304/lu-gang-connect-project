---
inclusion: fileMatch: ["*docker*", "*.yml", "*deploy*", "Dockerfile*"]
---
# 部署规范

## 环境
- 生产：GitHub Actions 构建 → ghcr.io → 服务器拉取
- 前端：docker-compose；后端：独立 docker run
- 网络：`lugang-connect-enterprise_default`

## 部署前检查
- [ ] 环境变量已配置
- [ ] 数据库迁移已执行
- [ ] 前端 `pnpm build` 无错误
- [ ] Docker 镜像构建成功

## 回滚
```bash
docker pull ghcr.io/taotie8304/lugang-ai:<上一版tag>
docker-compose up -d
```

## 禁止
- 直接在生产服务器修改代码（必须走 CI/CD）
- 未经测试直接部署 main 分支
