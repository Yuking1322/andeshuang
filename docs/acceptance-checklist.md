# 安的爽上线验收清单

这份清单用于发布前后的人工验收，重点确认登录链路、后台控制台、本地账号策略和 Cloudflare 安全配置都已经落地。

## 一、站点状态

- [ ] 打开 `https://andeshuang.pages.dev`
- [ ] 首页可以正常加载，没有白屏、明显样式错乱或资源 404
- [ ] 最新 Cloudflare Pages 部署状态为成功
- [ ] 主域名已经切到最新部署版本

## 二、LinuxDO 登录链路

- [ ] 点击“使用 LinuxDO 登录”
- [ ] 浏览器正确跳转到 `connect.linux.do/oauth2/authorize`
- [ ] 授权成功后回到 `https://andeshuang.pages.dev`
- [ ] 回跳后进入控制台，而不是停留在登录页
- [ ] 刷新页面后仍然保持登录状态
- [ ] 点击退出登录后，重新回到登录入口

重点排查项：

- [ ] LinuxDO Connect 后台回调地址仍为 `https://andeshuang.pages.dev/api/auth/linuxdo/callback`
- [ ] `LINUXDO_CLIENT_ID`、`LINUXDO_CLIENT_SECRET`、`SESSION_SECRET` 已在 Cloudflare 正式环境配置

## 三、本地账号策略

- [ ] `AUTH_DB` 已绑定到正式环境
- [ ] 登录页会按后台设置动态显示或隐藏注册入口
- [ ] 当前注册模式与后台“账号管理”页显示一致
- [ ] 如使用邀请码模式，登录页显示邀请码输入框
- [ ] 使用有效邀请码注册可以成功创建账号并自动登录
- [ ] 使用无效邀请码会得到明确错误提示
- [ ] 如设置了名额上限，注册满额后登录页不再开放注册
- [ ] 后台修改注册模式后，新开的登录页访问会按新策略生效

## 四、后台控制台

- [ ] 管理员账号登录后可以看到“管理后台”
- [ ] 第一页可以访问 Cloudflare、Pages、Analytics、下载分发入口
- [ ] 第二页可以看到“账号管理”
- [ ] 账号管理页能看到总注册人数、近 7 天注册、近 7 天登录、邀请码数量
- [ ] 账号管理页能直接保存注册模式、邀请码和名额上限
- [ ] 账号管理页能停用或恢复某个本地账号
- [ ] 被停用账号再次登录会收到明确提示
- [ ] 非管理员账号登录后看不到“管理后台”

## 五、控制台核心功能

- [ ] 可以下载体检脚本
- [ ] Windows 双击运行体检脚本后，能生成检测结果文件
- [ ] 检测结果导入页面后，左侧状态栏会更新已识别数量
- [ ] 可以正常搜索环境、切换分类、切换自动化等级和版本
- [ ] 依赖项会自动进入待安装列表
- [ ] 已安装项会被正确跳过
- [ ] 可以生成安装脚本并成功下载
- [ ] 可以生成卸载脚本并成功下载

## 六、预置下载与静态资源

- [ ] 7 个预置 Windows 下载包都能正常下载
- [ ] `lightning-mark.svg`、首页静态资源和样式文件都可正常加载
- [ ] 下载相关链接不会跳到错误地址

## 七、Cloudflare 安全与流量

- [ ] `public/_headers` 已在正式环境生效
- [ ] 响应头里可以看到 CSP、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Permissions-Policy`
- [ ] 已启用 Cloudflare Managed Ruleset
- [ ] 已为 `/api/auth/local/login` 和 `/api/auth/local/register` 配置 rate limiting rules
- [ ] 已配置针对 `/api/auth/*` 与 `/api/session` 的方法白名单 WAF custom rule
- [ ] `Security Events` 或 `Security Analytics` 中没有明显误拦截

可参考：

- [Cloudflare 限流 / WAF 建议](./cloudflare-security.md)

## 八、Analytics 与发布收尾

- [ ] Cloudflare Web Analytics 已启用
- [ ] 正式域名访问后，Cloudflare 后台能看到新的统计数据
- [ ] `npm run build` 在当前代码上可以通过
- [ ] LinuxDO Client Secret 如曾外泄，已完成轮换

## 九、发布记录

- [ ] 验收日期
- [ ] 验收人
- [ ] 线上域名
- [ ] Cloudflare 部署版本
- [ ] LinuxDO 登录结果
- [ ] 本地账号策略结果
- [ ] 后台控制台结果
- [ ] Analytics 结果
- [ ] 是否允许对外发布
