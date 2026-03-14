# Claude 工作指南

这份文档是给 Claude（AI 编程助手）看的项目快速上手指南。

## 项目基本信息

- **项目目录**：`E:\Document\Desktop\安的爽\andeshuang`
- **Git 仓库**：`https://github.com/Yuking1322/andeshuang.git`
- **主域名**：`https://andeshuang.me`
- **Pages 默认域名**：`https://andeshuang.pages.dev`
- **D1 数据库**：`andeshuang-auth`
- **Database ID**：`a9d1b5b8-3015-443b-8df1-5fd22374900d`

## 必读文档

在开始任何工作前，**必须先读这两份文档**：

1. `docs/debug-playbook.md` - 调试手册（包含本地开发、部署、D1 查询、常见问题排查）
2. `docs/handoff-2026-03-14.md` - 交接记录（当前项目状态、已完成事项、注意事项）

## 常用命令

### 本地开发
```bash
npm run dev:cf          # Cloudflare Pages Functions 联调（推荐）
npm run dev             # 纯前端预览（不含 Functions）
```

### 构建与部署
```bash
npm run build           # 构建到 dist/
npm run deploy:cf       # 构建并部署到 Cloudflare Pages
```

**重要**：这个项目使用**本地手动部署**，不是 GitHub 自动部署。每次修改代码后需要手动执行 `npm run deploy:cf` 才能更新线上。

### D1 数据库查询
```bash
# 查询远程 D1
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_users;"
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_auth_invites;"
npx wrangler d1 execute andeshuang-auth --remote --command "SELECT * FROM local_auth_settings;"
```

## 环境变量配置

本地开发配置文件：`.dev.vars`（不提交到 git）

关键配置项：
- `LINUXDO_CLIENT_ID` / `LINUXDO_CLIENT_SECRET` - LinuxDO OAuth
- `SESSION_SECRET` - 会话加密密钥
- `LINUXDO_ADMIN_USERNAMES` - 管理员用户名列表
- `LOCAL_AUTH_REGISTRATION_MODE` - 注册模式（public/invite_only/disabled）
- `LOCAL_AUTH_INVITE_CODES` - 邀请码列表
- `LOCAL_AUTH_REGISTRATION_LIMIT` - 注册名额上限
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID

## Cloudflare API 配置

已保存在 `.dev.vars`：
- **Account ID**：`651274bd72bd6dbed8d28a9272e2f536`
- **API Token**：已配置（需要定期轮换）

### 查询部署状态
```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/651274bd72bd6dbed8d28a9272e2f536/pages/projects/andeshuang/deployments" \
  -H "Authorization: Bearer <从.dev.vars读取>" \
  -H "Content-Type: application/json"
```

## 项目架构

### 前端
- `src/App.vue` - 主应用入口
- `src/components/AdminDashboard.vue` - 管理后台
- `src/components/EnvironmentSelector.vue` - 环境选择器
- `src/utils/adminApi.js` - 后台 API 调用
- `src/utils/sessionApi.js` - 会话 API 调用

### 后端（Cloudflare Pages Functions）
- `functions/api/session.js` - 会话接口
- `functions/api/auth/linuxdo/` - LinuxDO OAuth 登录
- `functions/api/auth/local/` - 本地账号注册/登录
- `functions/api/admin/` - 管理后台接口
- `functions/_shared/local-auth.js` - 本地认证逻辑
- `functions/_shared/admin.js` - 管理后台逻辑
- `functions/_shared/session.js` - 会话管理

### 数据库
- `migrations/0001_initial.sql` - 初始 schema
- `migrations/0002_local_auth_console.sql` - 本地账号控制台
- `migrations/0003_local_auth_invites.sql` - 邀请码表

## Git 工作流程

### 提交代码
```bash
git add <文件>
git commit -m "提交信息

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### 部署到线上
```bash
npm run deploy:cf
```

**注意**：推送到 GitHub 不会自动部署，必须手动执行 `npm run deploy:cf`。

## 重要注意事项

### 1. 部署方式
- ❌ 不是 GitHub 自动部署
- ✅ 使用 `npm run deploy:cf` 手动部署
- 部署后会生成新的预览地址（如 `https://7378db0c.andeshuang.pages.dev`）
- 主域名会自动切换到最新部署

### 2. 域名保护
- Cloudflare WAF 和 Rate Limiting 规则只作用在 `andeshuang.me`
- `andeshuang.pages.dev` 不受这些规则保护
- 对外推荐使用 `https://andeshuang.me`

### 3. API Token 安全
- Cloudflare API Token 已泄露过，需要定期轮换
- 不要在聊天中直接发送敏感信息
- 敏感配置只保存在 `.dev.vars`（已在 .gitignore 中）

### 4. 文案优化原则
- 删除设计说明文字（给开发者看的）
- 保留用户引导文字（给使用者看的）
- 所有文案必须中文化
- 避免冗长的说明，保持简洁

### 5. 代码修改后的完整流程
```bash
# 1. 修改代码
# 2. 提交到 git
git add .
git commit -m "描述"
git push origin main

# 3. 部署到线上
npm run deploy:cf

# 4. 验证
# 访问 https://andeshuang.me 确认更新
```

## 当前项目状态

### 已完成功能
- ✅ LinuxDO OAuth 登录
- ✅ 本地账号注册/登录（支持邀请码）
- ✅ 管理后台（账号管理、邀请码管理、注册策略控制）
- ✅ D1 数据库集成
- ✅ 自定义域名 `andeshuang.me` 接入
- ✅ Cloudflare 认证接口保护（WAF + Rate Limiting）
- ✅ AdminDashboard 文案优化（删除设计说明，中文化）

### 待优化项
- 后台 UI 继续打磨（视觉密度、间距、移动端适配）
- Cloudflare API Token 轮换
- 更细粒度的 Rate Limiting 规则（需要升级套餐）

## 常见问题排查

### 改了代码但线上没更新
1. 检查是否执行了 `npm run deploy:cf`
2. 清除浏览器缓存（Ctrl + F5）
3. 检查访问的是 `andeshuang.me` 还是旧的预览地址

### 本地调试登录失败
1. 检查 `.dev.vars` 配置是否完整
2. 使用 `npm run dev:cf` 而不是 `npm run dev`
3. 检查 D1 数据库是否有数据

### 后台接口 401/403
1. 检查当前用户是否在 `LINUXDO_ADMIN_USERNAMES` 中
2. 访问 `/api/session` 确认 `isAdmin: true`
3. 检查会话是否过期

## 线上运行机制

- 线上站点运行在 Cloudflare Pages + Functions
- 部署完成后，由 Cloudflare 边缘网络提供服务
- **不依赖本地电脑开机**
- 只有 `http://127.0.0.1:8788` 这种本地调试地址才依赖本机

## 下一步建议

根据交接文档，下一轮建议专注：
- 只打磨后台 UI，不再改认证逻辑
- 后台全部中文化
- 优化布局和视觉密度
- 移动端适配检查
