# 🛡️ ChainGuard AI 生产环境部署指南

本指南详细介绍了如何将 ChainGuard AI 从开发环境推向生产环境。由于系统采用了**前后端解耦与微服务架构**（React 19 前端 + Express API 网关 + FastAPI 物理/法务审计后端），我们提供了两种不同的部署方案：

1. **零成本部署方案 (Zero-Cost Prototype)**：适用于演示 (Demo) 和概念验证 (POC)。
2. **最佳性价比部署方案 (Production VPS)**：适用于正式小规模商业化与客户测试，解决服务休眠和冷启动问题。

---

## ⚙️ 通用环境变量配置

无论采用哪种部署方案，请准备好以下环境变量：

*   `DATABASE_URL`: SQLite 数据库路径，生产环境建议设置为 `sqlite:////var/lib/chainguard/chainguard.db`（确保目录有读写权限）。
*   `GEMINI_API_KEY`: *(可选)* 填入 Google AI Studio 的 Gemini API 密钥启用多 Agent 理赔定损辩论；如未填，系统会自动降级为科学公式与法理规则的**单点可信源规则引擎**。
*   `PORT`: Node 网关端口，默认为 `3000`。
*   `SUPABASE_URL` / `SUPABASE_ANON_KEY`: *(可选)* 用于持久化数据备份，免除易失性容器重建导致数据丢失的隐患。

---

## 方案一：零成本部署方案 (Hugging Face Spaces - 完全免费)

Hugging Face Spaces 提供免费且不自动休眠的 Docker 实例，拥有 **2 vCPU / 16GB RAM** 的超高配置，非常适合作为 ChainGuard AI 零成本的演示站。

### 1. 编写单容器多进程 `Dockerfile`
在项目根目录下创建 `Dockerfile`：

```dockerfile
FROM node:20-bookworm as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.10-slim-bookworm
WORKDIR /app

# 安装 Node.js 与系统依赖
RUN apt-get update && apt-get install -y curl supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 复制前端编译产物与网关
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --only=production

# 复制 Python 后端与依赖
COPY requirements.txt api.py generate_claim_pdf.py liability_scorer.py database.py crew_orchestrator.py ./
COPY contracts/ ./contracts/
RUN pip install --no-cache-dir -r requirements.txt

# 编写进程管理器 (Supervisor) 配置文件
RUN echo "[supervisord]\nnodaemon=true\n\n[program:fastapi]\ncommand=python api.py\nautostart=true\nautorestart=true\n\n[program:express]\ncommand=node dist/server.cjs\nautostart=true\nautorestart=true\n" > /etc/supervisor/conf.d/supervisord.conf

EXPOSE 3000
CMD ["/usr/bin/supervisord"]
```

### 2. 在 Hugging Face 部署
1. 登录 Hugging Face，创建一个新的 **Space**。
2. SDK 选择 **Docker**，并选择 Blank 模板。
3. 在 Space 的 **Settings** 中，添加你的 `GEMINI_API_KEY`（如需启用 AI 辩论）以及 Supabase 凭证（用于易失性存储下的数据持久化）。
4. 将代码推送到 Hugging Face 仓库，系统将自动构建并上线。

---

## 方案二：最佳性价比方案 (VPS 生产部署 - ~$5/mo)

在单台 Linux 云服务器（如 Hetzner、DigitalOcean、腾讯云或阿里云，1 vCPU / 2GB RAM / Ubuntu）上，利用 Nginx 将静态包与后台进程完美融合。

### 1. 环境准备
```bash
# 更新系统并安装 Node, Python 和 Nginx
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm python3-pip python3-venv nginx supervisor

# 验证安装
node -v
python3 --version
```

### 2. 后端进程管理 (FastAPI & Node)
生产环境建议使用 **PM2** 管理 Node 网关，使用 **Systemd** 或 **Supervisor** 守护 Python 进程：

**部署 Node 网关**：
```bash
npm install -g pm2
npm run build
pm2 start dist/server.cjs --name "chainguard-gateway"
pm2 save
pm2 startup
```

**部署 Python 后端**：
1. 建立虚拟环境并安装包：
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. 编写 `/etc/supervisor/conf.d/fastapi.conf`：
   ```ini
   [program:fastapi]
   directory=/home/ubuntu/chainguard-ai
   command=/home/ubuntu/chainguard-ai/venv/bin/python api.py
   autostart=true
   autorestart=true
   stderr_logfile=/var/log/fastapi.err.log
   stdout_logfile=/var/log/fastapi.out.log
   user=ubuntu
   ```
3. 启动后台守护：
   ```bash
   sudo supervisorctl reload
   ```

### 3. 配置 Nginx 反向代理与 SSL
编辑 `/etc/nginx/sites-available/default`，配置反向代理以支持前端静态目录和 API 请求路由分发：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态静态路由
    location / {
        root /home/ubuntu/chainguard-ai/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Express 微服务代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # FastAPI 直接审计代理
    location /v1/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

测试并重启 Nginx：
```bash
sudo nginx -t
sudo systemctl restart nginx
```

使用 **Certbot** 配置免费的 HTTPS (SSL 证书)：
```bash
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx -d yourdomain.com
```

### 4. 数据隔离与自动化备份
在服务器上设置 Cron 每日定时压缩 SQLite 数据库备份：
```bash
crontab -e
# 每日凌晨 2 点备份数据库
0 2 * * * cp /home/ubuntu/chainguard-ai/chainguard.db /home/ubuntu/backups/chainguard_$(date +\%F).db
```
