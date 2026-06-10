# 更新日志

本文件记录设研AI（mid-gpt）各版本的变更。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [v1.1.0] - 2026-06-10

灰度内测版：工作区增强、流式对话体验、图片蒙版编辑、灰度反馈留言板。

### 工作区与智能上下文（v1.1）

- **回答模式**：快速 / 深度分析 / 生成文档 / 提示词 / 产品顾问，切换后注入不同 system 指令
- **场景模板**：MVP、PRD、竞品分析等预设输出结构
- **项目与记忆**：项目选择器、项目记忆、用户画像、会话摘要组合进 prompt
- **风险检测**：敏感话题自动追加边界提示

### 对话与生图

- **全模式流式输出**：文字回复逐字渲染；流式阶段实时 Markdown 排版（GPT 风格字号与行距）
- **聊天 UI**：去掉 AI 小头像，助手回复撑满栏宽；思考状态不再重复占位
- **图片蒙版编辑**：点击生成图放大 → 左键涂抹 / 滚轮缩放 / 中键平移 → 局部改图
- **画幅保持**：有参考图时默认沿用原图画幅；蒙版外区域保护带
- **上传加速**：客户端压缩图片（最长边 2048）；上传与生图可观测日志
- **表格复制**：Markdown 表格右上角一键复制（TSV）

### 灰度反馈模块（可独立删除）

- **右侧浮层留言板**：内测用户匿名反馈 + 截图；公共瀑布流展示处理状态（✅ 已解决）
- **积分激励**：管理员核实后按档位发放 2 / 5 / 10 / 20 积分
- **管理后台**：`/admin/beta-feedback` 查看真实用户邮箱并标记解决
- **开关**：`NEXT_PUBLIC_BETA_FEEDBACK_ENABLED`；删除指南见 `src/features/beta-feedback/README.md`

### 管理后台

- **用量分析**：`/admin/analytics`
- **用户管理增强**：标签、调账、详情
- **生图 / 文本日志**、系统开关延续 v1.0.1

### 部署

- **Vercel**：`hkg1` 区域优先；`chat` API `maxDuration: 300`（Pro）
- **数据库**：Prisma 新增 `BetaFeedback`、`UserProfile`、`Project`、`ProjectMemory` 等模型

### 文档

- `sheyan-ai/docs/v1.1.0-workspace.md`
- `sheyan-ai/docs/commercialization-model.md`
- `sheyan-ai/docs/referral-and-pricing-strategy.md`

### 技术细节

| 模块 | 主要路径 |
|------|----------|
| 聊天 UI | `sheyan-ai/src/components/chat/user-app.tsx` |
| 流式 Markdown | `sheyan-ai/src/components/chat/markdown-message.tsx` |
| 图片编辑器 | `sheyan-ai/src/components/chat/image-editor-modal.tsx` |
| Prompt 上下文 | `sheyan-ai/src/lib/ai/prompt-context.ts` |
| 灰度反馈 | `sheyan-ai/src/features/beta-feedback/` |
| 聊天 API | `sheyan-ai/src/app/api/chat/route.ts` |

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

[ v1.1.0 ]: https://github.com/lyly58580000-maker/mid-gpt/compare/v1.0.1...v1.1.0
[ v1.0.1 ]: https://github.com/lyly58580000-maker/mid-gpt/compare/v1.0.0...v1.0.1
[ v1.0.0 ]: https://github.com/lyly58580000-maker/mid-gpt/releases/tag/v1.0.0
