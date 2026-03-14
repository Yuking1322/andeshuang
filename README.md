# 安的爽

安的爽是一个面向 Windows 优先场景的开发环境体检与一键安装控制台，当前基于 `Vue 3 + Vite + Element Plus + Cloudflare Pages Functions` 构建。

## 当前能力

- LinuxDO 登录，已走 Cloudflare Pages Functions 正式链路
- 本地内测账号注册 / 登录，账号数据存储在 Cloudflare D1
- 管理后台三页：运营入口、账号管理、上线状态
- 后台可直接查看注册人数、近 7 天注册 / 登录、邀请码数量、当前注册模式
- 后台可直接切换公开注册 / 邀请码注册 / 关闭注册，并支持设置注册名额上限
- 后台可直接停用或恢复某个本地账号
- 环境库扩容，并支持搜索、分类切换、自动化等级筛选、版本选择
- Windows 体检脚本扩展，预置下载包扩展到 7 个
- 安全头已上线：CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Permissions-Policy`

## 本地账号注册策略

本地账号注册现在支持三种模式：

- `public`
  公开注册
- `invite_only`
  只允许持有邀请码的用户注册
- `disabled`
  关闭公开注册，只保留已发放账号登录

支持的环境变量：

- `LOCAL_AUTH_REGISTRATION_MODE`
- `LOCAL_AUTH_INVITE_CODES`
- `LOCAL_AUTH_REGISTRATION_LIMIT`

说明：

- 后台控制台保存后的设置会写入 D1，并优先于环境变量生效
- 环境变量仍然可以作为默认值或兜底值
- 运行时会自动补齐后台所需的 D1 表结构，避免旧库升级时直接报错

## 关键文件

- `src/App.vue`
- `src/components/AdminDashboard.vue`
- `src/components/EnvironmentSelector.vue`
- `src/utils/adminApi.js`
- `src/utils/sessionApi.js`
- `functions/_shared/local-auth.js`
- `functions/_shared/admin.js`
- `functions/_shared/session.js`
- `functions/api/admin/overview.js`
- `functions/api/admin/auth/settings.js`
- `functions/api/admin/auth/users.js`
- `functions/api/auth/local/register.js`
- `functions/api/auth/local/login.js`
- `functions/api/session.js`
- `migrations/0002_local_auth_console.sql`

## 目录说明

- `src/`：前端页面、组件、脚本生成逻辑
- `functions/`：Cloudflare Pages Functions 接口
- `public/`：公开静态资源与下载文件
- `migrations/`：D1 数据库 migration
- `docs/`：部署、验收、安全加固文档

## 技术栈

- Vue 3
- Vite
- Element Plus
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- LinuxDO Connect OAuth

## 本地开发

- 纯前端预览：`npm run dev`
- Cloudflare Pages + Functions 联调：`npm run dev:cf`
- 生产构建：`npm run build`

可参考 `.dev.vars.example` 配置本地联调所需的 Secrets。

## 安全加固

- [Cloudflare 限流 / WAF 建议](./docs/cloudflare-security.md)
- 上线前请执行 [上线验收清单](./docs/acceptance-checklist.md)
- 调试 / 开发 / 部署细节请先看 [调试手册](./docs/debug-playbook.md)

## 相关文档

- [Cloudflare Pages + Functions 免费部署](./docs/deployment.md)
- [免费域名 / 分发 / 备用部署方案](./docs/free-alternatives.md)
- [交接记录（2026-03-14）](./docs/handoff-2026-03-14.md)
