# Cloudflare 限流 / WAF 建议

最后校对：2026-03-14

这份建议基于安的爽当前的访问模型：静态页面为主，真正会消耗 Functions 配额的核心接口集中在 `/api/auth/*` 和 `/api/session`。

## 1. 先启用的项

### 1.1 Managed Rules

先在 Cloudflare WAF 中启用 `Cloudflare Managed Ruleset`。官方文档说明这个规则集可用于常见 Web 攻击拦截，并支持自定义 override / exception，适合作为默认底座。

### 1.2 方法白名单 Custom Rule

用一条 WAF Custom Rule 直接在边缘挡掉不合理方法，减少无意义的 Functions 调用。可参考下面的表达式：

```txt
(
  (http.request.uri.path eq "/api/session" and not http.request.method in {"GET" "HEAD" "OPTIONS"}) or
  (http.request.uri.path eq "/api/auth/linuxdo/login" and not http.request.method in {"GET" "HEAD"}) or
  (http.request.uri.path eq "/api/auth/linuxdo/callback" and not http.request.method in {"GET" "HEAD"}) or
  (http.request.uri.path in {"/api/auth/local/login" "/api/auth/local/register" "/api/auth/logout"} and not http.request.method in {"POST" "OPTIONS"})
)
```

建议动作：`Block`

这条规则很保守，不依赖 Bot Score 或地区判断，误伤风险低。

## 2. Rate Limiting 建议

Cloudflare 官方文档说明：

- Rate limiting rules 按顺序执行，顺序会影响最终行为
- 速率统计不是绝对精确值，高并发下可能会多放过少量请求
- Free 计划的 rate limiting 表达式目前只支持 `Path` 和 `Verified bot`

因此这个项目建议使用“按路径拆分”的规则，不要一开始就做过度复杂的表达式。

### 建议起步阈值

#### `/api/auth/local/login`

- 阈值：`10 requests / 1 minute / per IP`
- 动作：`Managed Challenge`
- 缓解时长：`10 minutes`

#### `/api/auth/local/register`

- 阈值：`5 requests / 10 minutes / per IP`
- 动作：`Managed Challenge`
- 缓解时长：`1 hour`

#### `/api/auth/linuxdo/login`

- 阈值：`20 requests / 1 minute / per IP`
- 动作：`Managed Challenge`
- 缓解时长：`10 minutes`

#### `/api/session`

- 阈值：`120 requests / 1 minute / per IP`
- 动作：`Managed Challenge`
- 建议：先观察再开启。如果没有明显刷量，`/api/session` 可以暂时只靠缓存策略与 WAF 方法白名单

### 规则顺序建议

从上到下：

1. `/api/auth/local/register`
2. `/api/auth/local/login`
3. `/api/auth/linuxdo/login`
4. `/api/session`

这样更严格的规则会先命中，避免宽规则把细粒度规则覆盖掉。

## 3. Bot Fight Mode

如果线上流量主要来自浏览器用户，可以考虑启用 Bot Fight Mode 作为补充。但官方文档明确说明：Bot Fight Mode 不能通过 WAF custom rules 跳过。

因此建议流程是：

1. 先完成 Managed Rules + Rate Limiting
2. 在预览或低峰时段开启 Bot Fight Mode
3. 重点回归 LinuxDO OAuth 登录、回调与本地账号登录
4. 确认没有误伤后再长期启用

## 4. 上线后的观察点

- 在 `Security Events` / `Security Analytics` 里确认主要命中是否都来自真实异常流量
- 检查 `Managed Challenge` 是否误伤正常登录或注册
- 如果登录页用户较少，优先收紧 `/api/auth/local/register`
- 如果 `/api/session` 被频繁轮询，再单独收紧它，而不是一开始就把所有 API 一刀切

## 5. 官方参考

- [Cloudflare Managed Rulesets 文档](https://developers.cloudflare.com/waf/managed-rules/)
- [Cloudflare Custom Rules 文档](https://developers.cloudflare.com/waf/custom-rules/)
- [Cloudflare Rate Limiting Rules 文档](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Free plan 的 Rate Limiting 表达式限制说明](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)
- [Managed Challenge 动作说明](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/#mitigation-action)
- [Security Analytics / Events 参考](https://developers.cloudflare.com/waf/analytics/)
- [Bot Fight Mode 说明](https://developers.cloudflare.com/bots/get-started/free/)
