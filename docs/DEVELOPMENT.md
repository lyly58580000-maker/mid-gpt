# 设研AI 开发文档

> 版本：v1.1  
> 更新日期：2026-06-07  
> 目标：**上线可用的 Web 产品**（用户端 + 隐藏管理端）  
> 需求来源：`设研AI 产品需求文档 PRD.pdf` / `prd_extracted.txt` / `ai.tsx` 原型

---

## 1. 文档说明

本文档是 **设研AI** 的唯一技术实施标准，涵盖：技术选型、架构、AI 接入、账号体系、余额规则、上线清单与开发计划。

### 1.1 本期范围（你已确认）

| 包含 | 不包含 |
|------|--------|
| 用户登录 / 注册 | 自动充值、微信/支付宝支付 |
| 文本对话（GPT API） | 用户端任何「管理后台」入口或文案 |
| AI 生图（Image2 API） | 原型里的「切换至管理后台演示」按钮 |
| 聊天分组、历史记录 | 短信验证码（MVP 用邮箱+密码） |
| 余额展示、自动扣费、失败退款 | |
| 管理员**手动**调整用户额度 | |
| 管理后台（独立入口） | |
| 上线部署（国内服务器） | |

### 1.2 参考材料

| 文件 | 用途 |
|------|------|
| `设研AI 产品需求文档 PRD.pdf` | 产品需求权威来源 |
| `prd_extracted.txt` | PRD 文本版（便于检索） |
| `ai.tsx` | UI/交互原型（**需去掉管理端演示按钮**） |

---

## 2. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | **Next.js 15** (App Router) + **TypeScript** | React 全栈，与 `ai.tsx` 原型一致 |
| 样式 | **Tailwind CSS** + **shadcn/ui** | 极简 UI，组件可控 |
| 图标 / 图表 | lucide-react + Recharts | 原型已用 |
| 数据库 | **PostgreSQL 16** + **Prisma** | 用户、聊天、流水、日志 |
| 缓存 | **Redis 7**（推荐） | 登录限流、Session；MVP 可先省略 |
| 认证 | **Auth.js v5** + Credentials | 邮箱+密码，按角色分流 |
| AI 文本 | **OpenAI 兼容 API**（GPT 系列） | 通过 Vercel AI SDK 流式输出 |
| AI 生图 | **Image2 API**（OpenAI Images 兼容） | 服务端调用，结果存 OSS |
| 对象存储 | **阿里云 OSS** 或 **腾讯云 COS** | 存生图结果、用户头像 |
| 进程管理 | **PM2** | 生产环境守护 Node 进程 |
| 反向代理 | **Nginx** + **HTTPS** | 国内上线标配 |

---

## 3. 系统架构

```
                    ┌─────────────────────────────────┐
                    │  用户浏览器  →  /login  /chat   │  无任何管理端链接
                    └───────────────┬─────────────────┘
                                    │ HTTPS
                    ┌───────────────▼─────────────────┐
                    │  管理员浏览器 → /admin/login    │  独立 URL，不对外暴露
                    │              → /admin/*         │
                    └───────────────┬─────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────┐
│                         Next.js 单应用                                  │
│   用户端页面          管理端页面              API Routes                  │
│   /login             /admin/login           /api/chat                   │
│   /chat/*            /admin/*               /api/admin/*                │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   PostgreSQL              Redis（可选）          外部 API
   业务数据                 限流/Session           ├─ GPT API（文本）
                                                 └─ Image2 API（生图）
        │
        ▼
   对象存储 OSS/COS（生图图片永久 URL）
```

### 3.1 路由规划

#### 用户端（面向普通用户，界面干净）

| 路径 | 说明 |
|------|------|
| `/login` | 登录 / 注册（**仅用户文案，无管理员入口**） |
| `/chat` | 主聊天页 |
| `/chat/[conversationId]` | 指定会话 |

登录成功后：**仅 `USER` 角色** 进入 `/chat`。  
若管理员误用用户登录页，登录成功后按角色跳转（见 3.2），但页面上**不出现**任何「管理员」「后台」字样。

#### 管理端（独立入口，不在用户 UI 暴露）

| 路径 | 说明 |
|------|------|
| `/admin/login` | 管理员专用登录页（独立 URL，需自行收藏） |
| `/admin` | 总控仪表盘 |
| `/admin/users` | 用户管理 + **手动改额度** |
| `/admin/balance-records` | 余额流水 |
| `/admin/logs/text` | 文本调用日志 |
| `/admin/logs/image` | 生图日志 |
| `/admin/models` | GPT / Image2 模型与 Key 配置 |
| `/admin/settings` | 系统开关 |

> **开发约束：** 用户端 `layout`、登录页、侧边栏、弹窗中，禁止出现「管理后台」「管理员登录」「切换至管理端」等任何链接或按钮。原型 `ai.tsx` 第 735–737、196–198、972–974 行相关代码**不得迁入生产**。

### 3.2 登录与角色分流

```
/admin/login  ──→  校验账号  ──→  role=ADMIN  ──→  /admin
/login        ──→  校验账号  ──→  role=USER   ──→  /chat
                              ──→  role=ADMIN ──→  /admin（静默跳转，无 UI 提示）
```

- 两个登录页共用同一套 Auth，但 **URL 分离**。
- 中间件：`/admin/*` 必须 `ADMIN`；`/chat/*` 允许 `USER` 和 `ADMIN`（管理员也可体验用户端，但不从用户 UI 进入后台）。

### 3.3 权限中间件规则

| 路径 | 要求 |
|------|------|
| `/login` | 未登录可访问；已登录按角色跳转 |
| `/admin/login` | 未登录可访问；已登录 ADMIN 跳 `/admin` |
| `/chat/*` | 已登录（USER 或 ADMIN） |
| `/admin/*`（除 login） | 已登录且 ADMIN |
| `/api/admin/*` | ADMIN + 服务端二次校验 |

---

## 4. 预置账号（开发 / 上线种子数据）

通过 `prisma/seed.ts` 在首次部署时写入。**密码仅存哈希，明文仅写在 `.env` 与你的私有部署说明中。**

### 4.1 管理员账号

| 字段 | 值 |
|------|-----|
| 登录地址 | `https://你的域名/admin/login` |
| 邮箱 | `admin@sheyan.ai` |
| 密码 | `SheyanAdmin2026!`（**上线前务必修改**） |
| 角色 | `ADMIN` |
| 初始余额 | 0（管理员不使用扣费） |

### 4.2 普通用户账号（测试 / 演示）

| 字段 | 值 |
|------|-----|
| 登录地址 | `https://你的域名/login` |
| 邮箱 | `demo@sheyan.ai` |
| 密码 | `SheyanDemo2026!`（**上线前务必修改**） |
| 角色 | `USER` |
| 初始余额 | **100 点**（可在 seed 或后台调整） |

### 4.3 环境变量（与 seed 同步）

```bash
# prisma/seed 读取，勿提交到 Git
SEED_ADMIN_EMAIL="admin@sheyan.ai"
SEED_ADMIN_PASSWORD="SheyanAdmin2026!"
SEED_DEMO_EMAIL="demo@sheyan.ai"
SEED_DEMO_PASSWORD="SheyanDemo2026!"
SEED_DEMO_BALANCE="100"
```

---

## 5. AI 模型接入

### 5.1 文本模型 — GPT API

PRD 要求：用户无感选择模型，后台自动调用文本模型完成问答、写作、总结等。

**接入方式：** OpenAI 官方 API，或国内 **OpenAI 兼容中转**（如 OneAPI、New API、各类 API 聚合平台）。

```bash
# .env 生产配置
TEXT_API_BASE_URL="https://api.openai.com/v1"          # 或中转地址
TEXT_API_KEY="sk-xxxxxxxx"
TEXT_MODEL_NAME="gpt-4o-mini"                          # 可改为 gpt-4o / gpt-3.5-turbo
TEXT_MAX_OUTPUT_TOKENS="4096"
```

**服务端封装（`src/lib/ai/text-provider.ts`）：**

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const openai = createOpenAI({
  baseURL: process.env.TEXT_API_BASE_URL,
  apiKey: process.env.TEXT_API_KEY,
});

export async function generateTextReply(messages: CoreMessage[]) {
  return streamText({
    model: openai(process.env.TEXT_MODEL_NAME!),
    messages,
    maxTokens: Number(process.env.TEXT_MAX_OUTPUT_TOKENS ?? 4096),
  });
}
```

**需要记录（PRD 7.6）：** input/output/total tokens、响应时间、预估成本、实际成本、调用状态。

### 5.2 生图模型 — Image2 API

PRD 明确写「调用 **Image2** 生图模型」。按 **OpenAI Images API 兼容** 方式接入（`model: image-2` 或供应商指定名称）。

```bash
IMAGE_API_BASE_URL="https://api.openai.com/v1"         # 或 Image2 服务商地址
IMAGE_API_KEY="sk-xxxxxxxx"
IMAGE_MODEL_NAME="image-2"                             # 以供应商文档为准
IMAGE_SIZE="1024x1024"
IMAGE_QUALITY="standard"
```

**服务端封装（`src/lib/ai/image-provider.ts`）：**

```typescript
// POST {baseURL}/images/generations
// body: { model, prompt, size, n: 1 }
// 返回图片 URL 或 base64 → 上传 OSS → 存永久 URL 到 messages.image_url
```

**流程：**

1. 用户发送含生图意图的消息  
2. 服务端 `detectIntent()` → `image`  
3. 预扣 5 点 → 调用 Image2  
4. 图片转存 OSS（外链可能过期）  
5. 写入 `messages` + `usage_records` + 管理端生图日志  

### 5.3 意图识别（PRD 5.7）

用户端**不设模式切换**，服务端自动判断：

| 走 Image2 | 走 GPT 文本 |
|-----------|-------------|
| 生成一张、画一张、出一张图 | 帮我写、总结、解释、翻译 |
| 做一张海报、生成头像/插画 | 帮我写一个生图提示词（防误判，仍走文本） |
| 画面是、图片风格是 | 无法判断时**默认文本** |

实现文件：`src/lib/ai/intent.ts`（规则与 PRD 5.7 完全一致）。

### 5.4 模型 Key 管理

- **生产：** 优先读环境变量；管理端 `/admin/models` 可覆盖部分配置（存 `model_configs` 表，Key 加密存储）。
- **安全：** API Key **绝不**下发到浏览器；所有 AI 请求经 Next.js API Route 代理。

---

## 6. 余额与充值（本期：仅手动）

### 6.1 用户端

| 功能 | 实现 |
|------|------|
| 余额展示 | 侧边栏底部「余额 XX 点」 |
| 使用记录 | 弹窗列表（时间、类型、消耗、状态） |
| 余额不足 | 拦截调用，提示「余额不足，请联系管理员充值」 |
| 充值弹窗 | **本期简化**：展示说明文案 + 客服/联系信息，**无支付、无二维码自动到账** |

> PRD 6.2 阶段一「手动充值」：用户联系你 → 你在管理后台给用户加额度。本期只做这一条路径。

### 6.2 管理端（你日常运营用这个）

路径：`/admin/users` → 选择用户 → **调整余额**

| 操作 | 说明 |
|------|------|
| 增加点数 | `change_type = admin_adjust`，写 `balance_records` |
| 扣除点数 | 同上，金额为负 |
| 备注 | 必填，如「微信转账 30 元」 |

### 6.3 自动扣费（PRD 6.4 预扣费机制）

```
发送消息
  → 读 system_configs 开关
  → 余额 ≥ 扣点？
  → 事务：balance -= N，写 balance_records(consume, pending)
  → 调 GPT / Image2
  → 成功：usage_records(success)，扣费确认
  → 失败：balance += N，balance_records(refund)，usage_records(refunded)
```

**默认扣点（可在 `/admin/models` 或 `system_configs` 修改）：**

| 类型 | 默认 |
|------|------|
| 文本对话 | 1 点/次 |
| 生图 | 5 点/次 |

---

## 7. 数据库设计

与 PRD 第 8 章对齐。核心表：

| 表 | 用途 |
|----|------|
| `users` | 用户、角色、余额、状态 |
| `chat_groups` | 分组（每用户一个默认分组） |
| `conversations` | 会话 |
| `messages` | 消息（text / image） |
| `usage_records` | 使用记录（用户弹窗 + 管理日志） |
| `balance_records` | 余额流水 |
| `model_configs` | GPT / Image2 配置 |
| `system_configs` | 功能开关 |

**虚拟分组：**「全部聊天」不建表，前端传 `groupId=all` 查该用户全部会话。

**本期可省略或留空表：** `recharge_orders`（无自动充值时不写入，表结构可预留）。

完整 Prisma Schema 见附录 A。

---

## 8. API 接口（摘要）

### 8.1 用户端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录（Credentials） |
| POST | `/api/auth/register` | 注册（可选开放，受系统开关控制） |
| GET/POST/PATCH/DELETE | `/api/groups` | 分组 CRUD |
| GET/POST/PATCH/DELETE | `/api/conversations` | 会话 CRUD |
| GET | `/api/conversations/[id]/messages` | 历史消息 |
| POST | `/api/chat` | 发消息（文本 SSE 流式 / 生图 JSON） |
| GET | `/api/user/balance` | 余额 |
| GET | `/api/user/usage-records` | 使用记录 |

### 8.2 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/dashboard` | 仪表盘统计 |
| GET | `/api/admin/users` | 用户列表 |
| PATCH | `/api/admin/users/[id]/balance` | **手动改额度** |
| PATCH | `/api/admin/users/[id]/status` | 禁用/启用 |
| GET | `/api/admin/logs/text` | 文本调用日志 |
| GET | `/api/admin/logs/image` | 生图日志 |
| GET | `/api/admin/balance-records` | 全站余额流水 |
| GET/PATCH | `/api/admin/models` | 模型配置 |
| GET/PATCH | `/api/admin/settings` | 系统开关 |

---

## 9. 用户端 UI 约束（重要）

开发时必须遵守：

1. **登录页**只显示：设研AI、邮箱/密码、登录注册按钮、用户协议链接。  
2. **禁止**管理员入口、隐藏按钮、后台链接。  
3. **主聊天页**禁止「切换管理后台」浮动按钮（原型有，生产删除）。  
4. **充值弹窗**本期为「联系管理员充值」说明，不做在线支付 UI。  
5. 管理员日常通过浏览器直接访问 `/admin/login`，不依赖用户端跳转。

---

## 10. 上线前你需要准备什么

### 10.1 必购 / 必注册清单

| 序号 | 资源 | 用途 | 推荐 |
|------|------|------|------|
| 1 | **云服务器** | 跑 Next.js + Nginx | 阿里云 ECS / 腾讯云 CVM，**2核4G** 起，带宽 3M+ |
| 2 | **域名** | 用户访问 | `.com` / `.cn`，需 **ICP 备案**（国内服务器必须） |
| 3 | **PostgreSQL** | 业务数据库 | 云 RDS 或 Docker 自建在同一台服务器 |
| 4 | **对象存储** | 生图持久化 | 阿里云 OSS 或 腾讯云 COS |
| 5 | **GPT API** | 文本对话 | OpenAI 官方，或国内 OpenAI 兼容 API 平台 |
| 6 | **Image2 API** | 生图 | 提供 Image2 模型的 API 服务商（OpenAI Images 兼容） |
| 7 | **SSL 证书** | HTTPS | 免费 Let's Encrypt 或云厂商赠送 |

### 10.2 可选（建议有）

| 资源 | 用途 |
|------|------|
| Redis 云实例 | 登录限流、Session（用户量小可先不用） |
| 云监控 / 日志 | 阿里云 SLS、腾讯云 CLS |
| 错误追踪 | Sentry（可选） |

### 10.3 不需要本期准备

| 资源 | 原因 |
|------|------|
| 微信支付 / 支付宝商户号 | 本期手动改额度 |
| 短信平台 | MVP 用邮箱+密码 |
| 小程序 / App 资质 | 纯 Web |

### 10.4 服务器最低配置建议

| 项目 | 建议 |
|------|------|
| CPU / 内存 | 2 核 4 GB（初期 <500 日活够用） |
| 系统 | Ubuntu 22.04 LTS |
| 磁盘 | 40 GB SSD（数据库 + 日志；图片走 OSS） |
| 地域 | 国内（与用户同区域，延迟低） |
| 安全组 | 开放 22（SSH）、80、443；**不**对公网开放 5432 |

### 10.5 域名与备案流程（国内上线）

1. 购买域名 → 实名认证  
2. 服务器在云平台做 **ICP 备案**（约 7–20 个工作日）  
3. 备案通过后解析域名到服务器 IP  
4. Nginx 配置 HTTPS  
5. 环境变量 `AUTH_URL=https://你的域名`  

### 10.6 你需要向 API 服务商拿到的信息

**GPT 文本：**

- API Base URL（如 `https://api.openai.com/v1` 或中转地址）  
- API Key  
- 可用模型名（如 `gpt-4o-mini`）  
- 计费方式（按 token，用于后台成本统计）

**Image2 生图：**

- API Base URL  
- API Key  
- 模型名是否为 `image-2`（以文档为准）  
- 支持尺寸、单次价格  

---

## 11. 环境变量（完整）

```bash
# ========== 应用 ==========
NODE_ENV=production
AUTH_URL=https://your-domain.com
AUTH_SECRET=请替换为64位随机字符串

# ========== 数据库 ==========
DATABASE_URL=postgresql://sheyan:强密码@127.0.0.1:5432/sheyan_ai

# ========== Redis（可选）==========
REDIS_URL=redis://127.0.0.1:6379

# ========== 种子账号 ==========
SEED_ADMIN_EMAIL=admin@sheyan.ai
SEED_ADMIN_PASSWORD=SheyanAdmin2026!
SEED_DEMO_EMAIL=demo@sheyan.ai
SEED_DEMO_PASSWORD=SheyanDemo2026!
SEED_DEMO_BALANCE=100

# ========== GPT 文本 API ==========
TEXT_API_BASE_URL=https://api.openai.com/v1
TEXT_API_KEY=sk-xxxx
TEXT_MODEL_NAME=gpt-4o-mini
TEXT_MAX_OUTPUT_TOKENS=4096
TEXT_CHARGE_POINTS=1

# ========== Image2 生图 API ==========
IMAGE_API_BASE_URL=https://api.openai.com/v1
IMAGE_API_KEY=sk-xxxx
IMAGE_MODEL_NAME=image-2
IMAGE_SIZE=1024x1024
IMAGE_CHARGE_POINTS=5

# ========== 对象存储 OSS ==========
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=sheyan-ai
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_PUBLIC_BASE_URL=https://sheyan-ai.oss-cn-hangzhou.aliyuncs.com
```

---

## 12. 部署架构（生产）

```
Internet
   │
   ▼
Nginx :443 (SSL, 你的域名)
   ├── /          → Next.js :3000
   ├── /admin     → Next.js :3000
   └── /api       → Next.js :3000

Next.js (PM2)
   ├── PostgreSQL :5432 (内网)
   ├── Redis :6379 (内网, 可选)
   ├── GPT API (HTTPS 出站)
   ├── Image2 API (HTTPS 出站)
   └── OSS (HTTPS 出站)
```

### 12.1 部署命令摘要

```bash
# 服务器上
git clone <你的仓库>
cd sheyan-ai
pnpm install
cp .env.example .env   # 填好生产变量
pnpm prisma migrate deploy
pnpm prisma db seed
pnpm build
pm2 start pnpm --name sheyan-ai -- start
```

### 12.2 上线检查清单

- [ ] 域名备案完成，HTTPS 正常  
- [ ] `.env` 中 GPT / Image2 Key 有效  
- [ ] OSS 桶已创建，跨域/读写权限正确  
- [ ] 种子账号可登录，**已改默认密码**  
- [ ] 用户端无管理端链接  
- [ ] `/admin/login` 可进后台，手动改额度生效  
- [ ] 发文本消息 → GPT 流式回复 → 扣 1 点  
- [ ] 发「画一张…」→ Image2 出图 → 扣 5 点  
- [ ] 调用失败 → 点数退回  
- [ ] 数据库每日备份  

---

## 13. 分阶段开发计划

### Phase 1 — 基础骨架（~1 周）

- [ ] Next.js + Tailwind + shadcn 初始化  
- [ ] Prisma + PostgreSQL + seed 预置账号  
- [ ] `/login` 与 `/admin/login` 分离，中间件鉴权  
- [ ] 用户端登录页 UI（**无管理入口**）  

**验收：** 两个预置账号分别进入 `/chat` 与 `/admin`

### Phase 2 — 用户端聊天（~2 周）

- [ ] 侧边栏、分组、历史会话（对齐 PRD 4.3–4.3.7）  
- [ ] 聊天区、流式文本、Image2 生图展示与下载  
- [ ] 意图识别 + GPT / Image2 真实 API 联调  
- [ ] 删除原型中所有管理端演示 UI  

**验收：** PRD 11.2、11.3

### Phase 3 — 余额系统（~1 周）

- [ ] 预扣费 / 失败退款  
- [ ] 余额展示、使用记录、余额不足拦截  
- [ ] 充值弹窗改为「联系管理员」说明  

**验收：** PRD 11.4（手动充值部分）

### Phase 4 — 管理后台（~2 周）

- [ ] 仪表盘、用户管理、**手动改额度**  
- [ ] 余额流水、文本/生图日志  
- [ ] 模型配置、系统开关  

**验收：** PRD 11.5

### Phase 5 — 上线（~1  week）

- [ ] Docker / PM2 + Nginx + HTTPS  
- [ ] OSS 图片转存  
- [ ] 备份与基础监控  

---

## 14. 项目目录结构

```
sheyan-ai/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts              # 预置 admin + demo 账号
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/login/           # 用户登录
│   │   ├── (user)/chat/            # 用户聊天
│   │   ├── admin/
│   │   │   ├── login/              # 管理员登录（独立）
│   │   │   └── ...                 # 后台各页
│   │   └── api/
│   ├── components/
│   │   ├── chat/
│   │   ├── sidebar/
│   │   ├── modals/                 # 无支付逻辑的充值说明弹窗
│   │   └── admin/
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── text-provider.ts    # GPT
│   │   │   ├── image-provider.ts   # Image2
│   │   │   └── intent.ts
│   │   ├── billing/
│   │   └── oss.ts
│   └── middleware.ts
├── docker-compose.yml
├── .env.example
└── docs/DEVELOPMENT.md
```

---

## 15. 安全要点

- 默认 seed 密码上线前**必须修改**  
- `/admin/login` 可加 IP 白名单（Nginx 层，可选）  
- API Key 仅服务端；`.env` 不入 Git  
- 登录失败 5 次 / 15 分钟锁定  
- 管理员改余额操作写审计日志（`balance_records.remark` 必填）  
- 生图 prompt 长度上限；失败不扣费  

---

## 16. 验收对照（PRD 第 11 章）

| PRD 章节 | 本期 |
|----------|------|
| 11.1 登录 | ✅ |
| 11.2 主聊天 | ✅ |
| 11.3 分组 | ✅ |
| 11.4 余额（手动充值） | ✅（无自动支付） |
| 11.5 管理后台 | ✅ |
| 12.3 自动充值预留 | ❌ 不做 |

---

## 附录 A — 完整 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole { USER ADMIN }
enum UserStatus { ACTIVE DISABLED }
enum MessageRole { user assistant system }
enum ContentType { text image }
enum UsageType { text image }
enum UsageStatus { pending success failed refunded }
enum BalanceChangeType { recharge consume refund admin_adjust system_gift }

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  nickname     String?
  avatar       String?
  balance      Int        @default(0)
  role         UserRole   @default(USER)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  lastLoginAt  DateTime?

  groups         ChatGroup[]
  conversations  Conversation[]
  usageRecords   UsageRecord[]
  balanceRecords BalanceRecord[]
}

model ChatGroup {
  id        String   @id @default(cuid())
  userId    String
  name      String
  sortOrder Int      @default(0)
  isDefault Boolean  @default(false)
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversations Conversation[]
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  groupId   String
  title     String   @default("新对话")
  status    String   @default("active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  group    ChatGroup @relation(fields: [groupId], references: [id])
  messages Message[]
}

model Message {
  id             String      @id @default(cuid())
  conversationId String
  userId         String
  role           MessageRole
  contentType    ContentType @default(text)
  content        String      @db.Text
  imageUrl       String?
  createdAt      DateTime    @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}

model UsageRecord {
  id             String       @id @default(cuid())
  userId         String
  conversationId String?
  messageId      String?
  usageType      UsageType
  modelName      String
  inputTokens    Int?
  outputTokens   Int?
  totalTokens    Int?
  costPoints     Int
  estimatedCost  Decimal?     @db.Decimal(10, 4)
  actualCost     Decimal?     @db.Decimal(10, 4)
  status         UsageStatus
  errorMessage   String?
  responseMs     Int?
  createdAt      DateTime     @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model BalanceRecord {
  id              String            @id @default(cuid())
  userId          String
  changeType      BalanceChangeType
  amount          Int
  balanceBefore   Int
  balanceAfter    Int
  relatedUsageId  String?
  remark          String?
  createdAt       DateTime          @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ModelConfig {
  id                   String   @id @default(cuid())
  modelType            String   // text | image
  modelName            String
  apiBaseUrl           String?
  apiKeyEncrypted      String?
  maxInputTokens       Int?
  maxOutputTokens      Int?
  chargePoints         Int      @default(1)
  costPerInputToken    Decimal? @db.Decimal(10, 8)
  costPerOutputToken   Decimal? @db.Decimal(10, 8)
  costPerImage         Decimal? @db.Decimal(10, 4)
  enabled              Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model SystemConfig {
  id          String   @id @default(cuid())
  configKey   String   @unique
  configValue String
  description String?
  updatedAt   DateTime @updatedAt
}
```

---

## 附录 B — 下一步

你说「开始 Phase 1」后，我将：

1. 初始化 Next.js 项目  
2. 写入 Prisma schema + seed（预置两个账号）  
3. 实现 `/login` 与 `/admin/login`（用户端零管理信息）  
4. 提供 `.env.example` 模板  

**请你提前准备：** 云服务器意向、GPT API Key、Image2 API Key（开发联调阶段就需要）。
