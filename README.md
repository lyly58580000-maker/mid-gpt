# mid-gpt / 设研AI

设研AI — 极简 AI 聊天与生图 Web 平台（Next.js + Prisma + SQLite）。

## 版本

完整更新说明见 **[CHANGELOG.md](./CHANGELOG.md)**。

| 版本 | 说明 |
|------|------|
| **[v1.0.1](https://github.com/lyly58580000-maker/mid-gpt/releases/tag/v1.0.1)** | 对话修复、并行聊天、注册送点、Vercel 部署完善 |
| [v1.0.0](https://github.com/lyly58580000-maker/mid-gpt/releases/tag/v1.0.0) | 首个可运行版本：聊天、生图、管理后台、余额流水 |

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
| `docs/DEPLOY_VERCEL.md` | **Vercel 上线步骤** |

## Vercel 部署

项目已关联 Vercel：`luyao-s-projects/mid-gpt`  
**还差一步**：在 Vercel 接入 Neon 数据库并配置 `DATABASE_URL`，详见 [docs/DEPLOY_VERCEL.md](./docs/DEPLOY_VERCEL.md)。
