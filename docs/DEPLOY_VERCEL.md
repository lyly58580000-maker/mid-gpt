# Vercel 部署指南

## 项目信息

- **Vercel 项目**：`mid-gpt`（团队 `luyao-s-projects`）
- **GitHub 仓库**：https://github.com/lyly58580000-maker/mid-gpt
- **应用目录**：`sheyan-ai`（单体仓库需在 Vercel 设置 Root Directory）

## 一键检查清单

1. [ ] 在 Vercel 项目设置中把 **Root Directory** 设为 `sheyan-ai`
2. [ ] 安装 **Neon Postgres** 并添加 `DATABASE_URL`
3. [ ] 设置 `AUTH_URL` 为线上域名
4. [ ] 重新部署 Production

---

## 第一步：配置 GitHub 根目录

打开：https://vercel.com/luyao-s-projects/mid-gpt/settings

在 **General → Root Directory** 填写：

```
sheyan-ai
```

保存后，每次 `git push` 会自动触发部署。

---

## 第二步：创建 PostgreSQL 数据库（必须）

Vercel 无状态环境**不能使用 SQLite**，必须用 PostgreSQL。

### 方式 A：Vercel 集成 Neon（推荐）

1. 打开并接受条款：  
   https://vercel.com/luyao-s-projects/~/integrations/accept-terms/neon?source=cli

2. 在终端执行：

```bash
cd sheyan-ai
npx vercel integration add neon
```

3. 在 Vercel 项目 **Storage** 中创建 Neon 数据库并连接到 `mid-gpt`

4. 确认环境变量里已有 `DATABASE_URL`（Neon 会自动注入）

### 方式 B：手动使用 Neon

1. 注册 https://neon.tech 并创建免费数据库
2. 复制连接串（`postgresql://...?sslmode=require`）
3. 在 Vercel → mid-gpt → Settings → Environment Variables 添加：

| 变量 | 值 |
|------|-----|
| `DATABASE_URL` | `postgresql://...` |

---

## 第三步：补全环境变量

以下变量已预先配置到 Vercel（除 `DATABASE_URL`、`AUTH_URL`）：

- `AUTH_SECRET`
- `TEXT_API_*` / `IMAGE_API_*`
- `SEED_*`（首次部署自动创建管理员与演示账号）

**部署成功后**在 Vercel 添加：

| 变量 | 示例 |
|------|------|
| `AUTH_URL` | `https://mid-gpt.vercel.app`（换成你的生产域名） |

---

## 第四步：部署

### 自动部署（推荐）

```bash
git push origin main
```

### 手动部署

```bash
cd sheyan-ai
npx vercel deploy --prod
```

---

## 预置账号（首次 seed 后）

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@sheyan.ai | SheyanAdmin2026! |
| 演示用户 | demo@sheyan.ai | SheyanDemo2026! |

---

## 与本地开发的差异

| 功能 | 本地 | Vercel |
|------|------|--------|
| 数据库 | 可自建 Postgres / 原 SQLite 已改为 Postgres | Neon Postgres |
| 生图 | 保存到 `public/generated` | 使用 API 返回的远程图片 URL |
| 附件上传 | 保存到 `public/uploads` | 图片用内存 data URL，文档提取文本 |

---

## 常见问题

**构建报错 `URL must start with postgresql://`**  
→ 未配置 `DATABASE_URL`，完成第二步。

**登录后跳回登录页**  
→ `AUTH_URL` 与访问域名不一致，改成实际 Vercel 域名。

**API 调用失败**  
→ 检查 `TEXT_API_KEY` / `IMAGE_API_KEY` 是否在 Vercel 环境变量中正确配置。
