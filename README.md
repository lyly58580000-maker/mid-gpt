# mid-gpt / 设研AI

设研AI — 极简 AI 聊天与生图 Web 平台（Next.js + Prisma + SQLite）。

## 版本

- **v1.0.0** — 首个可运行版本：用户聊天、生图、管理后台、余额流水、用户标签

## 快速启动

```bash
cd sheyan-ai
npm install
cp .env.example .env.local   # 填入 QuickRouter API Key
npm run db:setup
npm run dev
```

- 用户端：http://127.0.0.1:3000/login
- 管理端：http://127.0.0.1:3000/admin/login

详细说明见 [sheyan-ai/README.md](./sheyan-ai/README.md) 与 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

## 目录

| 路径 | 说明 |
|------|------|
| `sheyan-ai/` | 主应用（Next.js 16） |
| `docs/` | 开发文档 |
