# ============================================
# 鲁港通企业版 Docker 构建文件
# Lu-Gang Connect Enterprise Edition
# ============================================

# 第一阶段：构建前端
FROM node:16.20-alpine AS web-builder

WORKDIR /web

# 复制前端源码
COPY ./web ./
COPY ./VERSION ./

# 设置npm镜像源加速下载
RUN npm config set registry https://registry.npmmirror.com

# 品牌替换：将One API替换为鲁港通企业版
RUN find . -type f -name "*.js" -exec sed -i 's/One API/鲁港通企业版/g' {} \; && \
    find . -type f -name "*.json" -exec sed -i 's/One API/鲁港通企业版/g' {} \; && \
    find . -type f -name "*.html" -exec sed -i 's/One API/鲁港通企业版/g' {} \;

# 构建berry主题
WORKDIR /web/berry

# 清理并安装依赖，添加缺失的ajv
RUN rm -rf node_modules package-lock.json && \
    npm install ajv@8 ajv-keywords@5 --save-dev --legacy-peer-deps && \
    npm install --legacy-peer-deps

# 构建前端
RUN DISABLE_ESLINT_PLUGIN='true' REACT_APP_VERSION=$(cat /web/VERSION) npm run build || \
    (echo "Berry build failed, creating placeholder" && mkdir -p build)

# 确保build目录存在，并复制默认的index.html作为后备
RUN mkdir -p /web/build/berry && \
    (cp -r /web/berry/build/* /web/build/berry/ 2>/dev/null || true) && \
    if [ ! -f /web/build/berry/index.html ]; then \
        echo "Berry build failed, copying default index.html"; \
        cp /web/index.html /web/build/index.html 2>/dev/null || true; \
    fi

# 第二阶段：构建Go后端
FROM golang:1.21-alpine AS go-builder

# 安装必要的包
RUN apk add --no-cache g++ ca-certificates tzdata git

# 设置环境变量和Go代理加速下载
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    GO111MODULE=on \
    CGO_ENABLED=1 \
    GOOS=linux \
    GOPROXY=https://goproxy.cn,direct

WORKDIR /build

# 复制依赖文件并下载
COPY go.mod go.sum ./
RUN go mod download

# 复制所有源代码（包含默认的 web/build/index.html）
COPY . .

# 备份默认的 index.html
RUN cp ./web/build/index.html /tmp/default_index.html 2>/dev/null || true

# 复制构建好的前端文件到正确位置
COPY --from=web-builder /web/build ./web/build/

# 如果 berry 构建失败，恢复默认的 index.html
RUN if [ ! -f ./web/build/berry/index.html ]; then \
        echo "Berry build failed, restoring default index.html"; \
        cp /tmp/default_index.html ./web/build/index.html; \
    fi

# 构建鲁港通企业版
RUN go build -trimpath -ldflags "-s -w -X 'github.com/lugang-connect/enterprise/common.Version=v1.0.0-lugang'" -o lugang-enterprise

# 第三阶段：最终运行镜像
FROM alpine:latest

# 设置UTF-8环境和时区
RUN apk update && \
    apk upgrade && \
    apk add --no-cache ca-certificates tzdata && \
    update-ca-certificates 2>/dev/null || true

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Asia/Shanghai \
    GIN_MODE=release

# 创建应用目录和日志目录
RUN mkdir -p /app/logs /app/data /app/web/build

# 复制编译好的程序
COPY --from=go-builder /build/lugang-enterprise /app/

# 复制前端静态文件
COPY --from=go-builder /build/web/build /app/web/build/

# 设置工作目录
WORKDIR /app

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/status || exit 1

# 启动命令
ENTRYPOINT ["./lugang-enterprise"]
