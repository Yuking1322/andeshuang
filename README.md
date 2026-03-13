# 安的爽

安的爽是一个面向 Windows 优先、兼顾 Linux 扩展的开发环境体检与一键安装工具。

当前项目基于 `Vue 3 + Vite + Element Plus`，产品方向包括：

- LinuxDO 登录后进入控制台
- 本机环境体检与结果导入
- 按需生成安装脚本与“后悔药”卸载脚本
- 预置 Windows 傻瓜包分发
- Cloudflare Pages + Functions 免费部署

## 当前定位

这个项目不是单纯的脚本集合，而是一个“先登录 -> 再体检 -> 再配置 -> 再执行”的环境控制台。

核心目标：

- 让普通用户也能知道自己电脑里已经装了什么
- 自动跳过已安装的软件，减少重复安装
- 提供尽量傻瓜式的安装与卸载体验
- 为后续的账户、模板、历史记录和云端同步预留空间

## 功能概览

- LinuxDO OAuth 登录
- 控制台式环境管理界面
- 管理员后台第一页
- Windows 一键体检器下载
- 安装脚本动态生成
- “后悔药”卸载脚本动态生成
- Windows 预置傻瓜包下载
- 安装日志与失败排查提示
- Cloudflare Web Analytics 可选接入

## 技术栈

- Vue 3
- Vite
- Element Plus
- Cloudflare Pages
- Cloudflare Pages Functions
- LinuxDO Connect OAuth

## 目录说明

- `src/`：前端页面、组件、脚本生成逻辑
- `functions/`：Cloudflare Pages Functions 接口（登录、会话、后台总览）
- `public/`：公开静态资源、图标、预置下载文件
- `docs/deployment.md`：Cloudflare Pages + Functions 主部署方案
- `docs/free-alternatives.md`：免费域名 / 免费分发 / 免费替代方案说明

## 开发重点

当前开发优先级：

1. 先把 LinuxDO 登录与 Cloudflare Functions 跑通
2. 再把 Windows 优先分发、管理员后台和预置傻瓜包做完整
3. 最后再扩展 Linux 入口、模板同步和历史能力

## LinuxDO 应用信息

LinuxDO Connect 后台建议填写：

- 应用名：`安的爽`
- 应用主页：`https://andeshuang.pages.dev`
- 应用描述：`安的爽是一个面向 Windows / Linux 的开发环境体检与一键安装工具，支持环境识别、脚本分发与 LinuxDO 登录。`
- 回调地址：`https://andeshuang.pages.dev/api/auth/linuxdo/callback`
- 应用图标：`https://andeshuang.pages.dev/logo.png`

注意：

- `Client Secret` 不要提交到仓库
- 如果 Secret 在聊天、截图或论坛里暴露过，部署前先旋转

## 部署文档

主方案：

- [Cloudflare Pages + Functions 免费部署](./docs/deployment.md)

替代方案：

- [免费域名 / 分发 / 备用部署方案](./docs/free-alternatives.md)

## 本地开发

- 纯前端预览：`npm run dev`
- Cloudflare Pages + Functions 联调：`npm run dev:cf`
