# 灰度反馈模块（可整包删除）

内测期用户反馈浮窗 + 公共留言板 + 管理后台。与主聊天逻辑隔离，删除时不应影响核心功能。

## 开启

`.env.local` 增加：

```env
NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=true
```

然后执行数据库迁移：

```bash
npx prisma db push
```

## 目录清单

| 路径 | 说明 |
|------|------|
| `src/features/beta-feedback/` | 配置、类型、服务、UI 组件 |
| `src/app/api/beta-feedback/` | 用户 API（列表、提交、上传） |
| `src/app/api/admin/beta-feedback/` | 管理 API |
| `src/app/admin/beta-feedback/page.tsx` | 管理后台页面 |
| `prisma/schema.prisma` | `BetaFeedback` 模型 + `BetaFeedbackStatus` 枚举 |

## 集成点（删除时需还原）

1. `src/app/layout.tsx` — 移除 `<BetaFeedbackMount />` 及 import
2. `src/app/admin/layout.tsx` — 移除导航项「灰度反馈」

## 完整删除步骤

1. 设 `NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=false` 或删除该变量
2. 删除上表所有目录/文件
3. 从 `schema.prisma` 删除 `BetaFeedback` 模型、`BetaFeedbackStatus` 枚举、`User.betaFeedbacks` 关系
4. 执行 `npx prisma db push`（可选 `DROP TABLE` 清理数据）
5. 还原 `layout.tsx` 与 `admin/layout.tsx` 两处集成

## 积分档位

| 档位 | 积分 | 适用 |
|------|------|------|
| 小建议 | 2 | 文案/样式 |
| 体验问题 | 5 | 可复现体验问题 |
| 功能缺陷 | 10 | 功能异常 |
| 高价值发现 | 20 | 崩溃/安全/支付 |

管理员在后台标记「已解决」时选择档位，积分自动发放并显示在公共留言板。
