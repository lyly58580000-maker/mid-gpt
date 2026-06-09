#    设研AI

极简 AI 聊天与生图 Web 平台。

## 快速启动

```bash
cd sheyan-ai
npm install
npm run db:setup
npm run dev
```

访问：

- 用户端：[http://127.0.0.1:3000/login](http://127.0.0.1:3000/login)
- 管理端：[http://127.0.0.1:3000/admin/login](http://127.0.0.1:3000/admin/login)

> 开发服务绑定在 `127.0.0.1`，请不要用 `localhost` 登录，否则 cookie 可能对不上导致“登录没反应”。

## 预置账号


| 角色   | 邮箱                                        | 密码               |
| ---- | ----------------------------------------- | ---------------- |
| 管理员  | [admin@sheyan.ai](mailto:admin@sheyan.ai) | SheyanAdmin2026! |
| 演示用户 | [demo@sheyan.ai](mailto:demo@sheyan.ai)   | SheyanDemo2026!  |


## 环境变量

复制 `.env.example` 为 `.env.local`，填入 OpenAI API Key。

**重要：** API Key 不要提交到 Git。若 Key 已泄露，请立即在 OpenAI 控制台轮换。

## 功能

- 用户登录 / 注册
- GPT 文本对话（流式）
- Image2 / DALL-E 生图（自动 fallback）
- 聊天分组与历史
- 余额扣费 / 失败退款
- 管理后台手动改额度
- 系统开关

## 生产部署

详见 `../docs/DEVELOPMENT.md`