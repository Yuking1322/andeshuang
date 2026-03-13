# Cloudflare Pages + Functions 部署说明

这份文档是安的爽的主部署方案，目标是：

- 前端静态资源走 Cloudflare Pages
- LinuxDO OAuth 回调走 Cloudflare Pages Functions
- 保持尽量免费、尽量轻量、尽量好维护

## 一、推荐架构

建议采用这一套：

- 前端页面：Cloudflare Pages
- 登录回调与会话接口：Cloudflare Pages Functions
- 公开静态资源：Pages 自带静态托管
- 预置 Windows 下载包：先放 Pages 静态目录
- 以后大文件：切到 GitHub Releases 或 Cloudflare R2

推荐默认域名：

- `https://andeshuang.pages.dev`

如果后面要自定义域名，再额外绑定即可；前期完全可以先用免费二级域名。

## 二、LinuxDO Connect 后台填写

LinuxDO Connect 申请应用时，建议填写：

- 应用名：`安的爽`
- 应用主页：`https://andeshuang.pages.dev`
- 应用描述：`安的爽是一个面向 Windows / Linux 的开发环境体检与一键安装工具，支持环境识别、脚本分发与 LinuxDO 登录。`
- 回调地址：`https://andeshuang.pages.dev/api/auth/linuxdo/callback`
- 应用图标：`https://andeshuang.pages.dev/logo.png`
- 最低等级：`0级`

注意：

- 回调地址必须是服务端接收授权码的地址
- 不要把 `Client Secret` 放到前端环境变量里

## 三、Cloudflare Secrets 约定

Pages Functions 侧统一使用这些变量名：

- `LINUXDO_CLIENT_ID`
- `LINUXDO_CLIENT_SECRET`
- `LINUXDO_REDIRECT_URI`
- `LINUXDO_AUTH_URL`
- `LINUXDO_TOKEN_URL`
- `LINUXDO_USER_URL`
- `SESSION_SECRET`
- `LINUXDO_ADMIN_USERNAMES`
- `CLOUDFLARE_DASHBOARD_URL`
- `CLOUDFLARE_PAGES_PROJECT_URL`
- `CLOUDFLARE_WEB_ANALYTICS_URL`
- `CLOUDFLARE_DOWNLOADS_URL`

推荐值：

- `LINUXDO_AUTH_URL=https://connect.linux.do/oauth2/authorize`
- `LINUXDO_TOKEN_URL=https://connect.linux.do/oauth2/token`
- `LINUXDO_USER_URL=https://connect.linux.do/api/user`
- `LINUXDO_REDIRECT_URI=https://andeshuang.pages.dev/api/auth/linuxdo/callback`

`SESSION_SECRET` 建议使用足够长的随机字符串，不要和 LinuxDO Secret 复用。

## 四、本地开发建议

本地开发建议用 Pages Functions 的本地方式，而不是只跑纯 Vite 静态页。

推荐思路：

1. 准备一份不提交仓库的 `.dev.vars`
2. 运行 `npm run dev:cf`
3. 让脚本自动监听前端构建、静态下载包生成和 Pages Functions 预览

本地 `.dev.vars` 示例字段应与线上 Secrets 保持一致：

```env
LINUXDO_CLIENT_ID=
LINUXDO_CLIENT_SECRET=
LINUXDO_REDIRECT_URI=http://127.0.0.1:8788/api/auth/linuxdo/callback
LINUXDO_AUTH_URL=https://connect.linux.do/oauth2/authorize
LINUXDO_TOKEN_URL=https://connect.linux.do/oauth2/token
LINUXDO_USER_URL=https://connect.linux.do/api/user
SESSION_SECRET=
LINUXDO_ADMIN_USERNAMES=
CLOUDFLARE_DASHBOARD_URL=https://dash.cloudflare.com/
CLOUDFLARE_PAGES_PROJECT_URL=
CLOUDFLARE_WEB_ANALYTICS_URL=
CLOUDFLARE_DOWNLOADS_URL=
```

注意：

- `.dev.vars` 不应提交仓库
- 如果 LinuxDO Connect 只允许一个回调地址，而当前后台填的是线上地址，那么完整 OAuth 登录应优先在线上 `pages.dev` 环境验证
- 本地开发仍然推荐保留 `.dev.vars`，这样 `/api/session`、退出登录、配置检查等链路都可以先跑起来

## 五、部署流程建议

### 方案 A：直接在 Cloudflare Pages 面板部署

适合先跑起来：

1. 把仓库连到 Cloudflare Pages
2. 构建命令填项目现有构建命令
3. 输出目录指向静态构建产物目录
4. 在 Pages 项目里配置 Secrets
5. 部署后访问 `pages.dev` 域名测试登录回调

### 方案 B：CLI / 自动化部署

适合后续接 CI：

1. 本地或 CI 执行前端构建
2. 通过 Cloudflare 工具发布静态资源和 Functions
3. 统一在 CI 中注入 Secrets

## 六、登录链路

推荐的登录链路：

1. 未登录用户打开首页，只看到登录前置页
2. 点击“使用 LinuxDO 登录”
3. 跳到 `/api/auth/linuxdo/login`
4. Functions 生成 `state`，重定向到 LinuxDO 授权页
5. LinuxDO 回调到 `/api/auth/linuxdo/callback`
6. Functions 用 `code` 换 token，再去 `User Endpoint` 拉用户信息
7. Functions 写入 httpOnly Cookie
8. 前端请求 `/api/session`，确认已登录后进入控制台

## 七、静态资源与下载包

适合直接放在 Pages 的内容：

- `logo.png`
- `favicon`
- 小体积脚本
- 预置 Windows `.bat` / `.cmd`
- 体检器和卸载脚本模板

不建议长期直接放仓库的内容：

- 大体积 Windows 安装器
- 打包好的大型依赖集合
- 未来的多平台桌面分发包

这类资源建议迁移到：

- GitHub Releases
- Cloudflare R2

## 八、管理员后台第一页

当前项目已经带了一个“管理员后台”第一页，主要用于：

- 展示当前登录管理员
- 进入 Cloudflare 总控台
- 进入访问量入口
- 进入下载量入口
- 查看当前免费方案的运营说明

其中具体跳转链接优先读取以下配置：

- `LINUXDO_ADMIN_USERNAMES`
- `CLOUDFLARE_DASHBOARD_URL`
- `CLOUDFLARE_PAGES_PROJECT_URL`
- `CLOUDFLARE_WEB_ANALYTICS_URL`
- `CLOUDFLARE_DOWNLOADS_URL`

`LINUXDO_ADMIN_USERNAMES` 使用逗号分隔用户名，只有命中的 LinuxDO 用户才能看到“管理后台”入口。

## 九、排错建议

### 登录失败

优先检查：

- 回调地址是否和 LinuxDO 后台一致
- Secret 是否填错
- Cookie 是否被浏览器拦截
- Pages Functions 是否已经部署成功

### 页面能打开但登录后还是回到入口页

优先检查：

- `/api/session` 是否返回已登录状态
- 会话 Cookie 是否成功写入
- `SESSION_SECRET` 是否稳定一致

### 下载脚本正常但运行失败

优先检查：

- 是否有管理员权限
- 网络或代理是否影响 Chocolatey / Scoop
- 目标机器是否已有冲突软件
- 日志文件里失败的是哪一项

## 十、上线前检查清单

- LinuxDO 后台应用信息填写完整
- 回调地址与线上域名一致
- `Client Secret` 没有出现在仓库
- `logo.png` 可以公网访问
- 登录前置页生效
- 未登录不能进入控制台
- 体检器、安装脚本、后悔药都能正常下载
- 至少用一台真实 Windows 机器做过完整验证
