# 更新日志

本文件记录设研AI（mid-gpt）各版本的变更。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v1.0.1] - 2026-06-09

### 对话与 AI

- **修复 LLM 不回复**：QuickRouter `gpt-5.5` 使用 Responses API，`generateText` 会报 `Invalid JSON response`，改回 `streamText` 后回复正常
- **优化 API 错误提示**：额度不足、Key 无效等错误显示明确中文说明，不再误报「模型未返回内容」
- **图片上下文**：生成图片后追问「这张图…」时，自动将图片附带给模型，无需重复上传
- **图片读取降级**：远程图片读取失败时退回纯文本，避免整次请求失败
- **发送前额度预检**：QuickRouter API 余额为 0 时提前提示，减少无效扣点

### 聊天体验

- **切换对话不闪屏**：用 `history.replaceState` 替代 `router.replace`，避免页面重挂载导致白屏
- **并行对话**：一个对话在生成时，可切换其他聊天、新建聊天；各对话独立管理生成状态
- **侧边栏生成指示**：正在回答的对话显示旋转图标
- **加载体验**：切换对话时保留旧内容半透明加载，不再整块骨架屏占位
- **助手消息操作**：回答下方支持「复制」「重新生成」
- **用户消息操作**：支持「复制」「编辑并重发」

### 注册与运营

- **新用户注册送点**：默认赠送 20 点（后台可配 `register_welcome_points`）
- **注册成功提示**：进入聊天页显示绿色欢迎条
- **用增商业化文档**：新增 `sheyan-ai/docs/growth-and-monetization.md` 路线图

### 管理后台

- **系统设置**：支持配置新用户注册赠送点数（与文本/生图扣点同一页）

### 部署与基础设施

- **Vercel 部署**：补充 `vercel.json`、Neon PostgreSQL 说明（`docs/DEPLOY_VERCEL.md`）
- **数据库**：Prisma 切换 PostgreSQL；Neon 空闲断连时自动重试
- **生图 / 上传**：Vercel 环境使用远程图片 URL，避免本地文件系统写入失败
- **构建修复**：修复 TypeScript 与部署路径相关错误

### 技术细节

| 模块 | 主要文件 |
|------|----------|
| 聊天 UI | `sheyan-ai/src/components/chat/user-app.tsx` |
| 文本模型 | `sheyan-ai/src/lib/ai/text-provider.ts` |
| 聊天 API | `sheyan-ai/src/app/api/chat/route.ts` |
| 注册 | `sheyan-ai/src/app/api/auth/register/route.ts` |

---

## [v1.0.0] - 2026-06-07

首个正式发布版本。

### 功能

- 用户端：邮箱注册 / 登录、多轮对话、Markdown 渲染、附件上传（图片 / 文档）
- 生图：基于 QuickRouter `gpt-image-2`
- 管理端：用户管理、余额流水、API 额度概览、系统开关（注册 / 充值 / 维护模式）
- 计费：平台点数预扣、失败退款、用量记录

### 预置账号（seed）

- 演示用户：`demo@sheyan.ai`
- 管理员：`admin@sheyan.ai`

---

[ v1.0.1 ]: https://github.com/lyly58580000-maker/mid-gpt/compare/v1.0.0...v1.0.1
[ v1.0.0 ]: https://github.com/lyly58580000-maker/mid-gpt/releases/tag/v1.0.0
