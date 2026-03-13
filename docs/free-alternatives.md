# 免费域名 / 免费部署 / 免费分发替代方案

这份文档整理的是安的爽可以优先采用的“白嫖方案”。

目标不是追求最复杂的架构，而是先把：

- 登录
- 页面
- 脚本分发
- Windows 预置包下载

都在尽量低成本的前提下跑起来。

## 一、最推荐的免费组合

推荐优先级：

1. `Cloudflare Pages + pages.dev`
2. `Cloudflare Pages + Functions`
3. `GitHub Releases` 或 `Cloudflare R2` 做大文件补充

为什么推荐：

- 前端静态页免费
- 默认二级域名免费
- 小体积脚本分发很合适
- 可以顺手承接 OAuth 回调

## 二、免费域名替代

### 1. Cloudflare 默认二级域名

可直接使用：

- `*.pages.dev`
- `*.workers.dev`

适合：

- 前期验证产品
- 不想先买域名
- 想先把 LinuxDO 登录和下载链路跑通

推荐：

- 页面站点优先用 `pages.dev`
- 如果以后某些接口单独拆出去，再考虑 `workers.dev`

### 2. 自定义域名

不是必须。

如果后续你想做正式品牌化，再补自己的域名即可；前期直接跑免费二级域名完全没问题。

## 三、Cloudflare Pages vs Workers

### Cloudflare Pages

适合：

- 前端静态页面
- 小脚本分发
- 图标、截图、下载页
- Pages Functions 这类轻量回调

优点：

- 更贴合前端项目
- 上手简单
- 和 Vite 项目契合度高

### Cloudflare Workers

适合：

- 以后想拆独立接口服务
- 做更重的后端逻辑
- 做资源转发或中间层

当前不建议一开始就把整个项目全部收进 Workers。

更实用的路线是：

- 先 Pages
- 不够了再局部补 Workers

## 四、大文件分发替代

如果只是：

- `.cmd`
- `.bat`
- `.ps1`
- 小型 zip

直接放 Pages 就够了。

如果以后要分发：

- 体积更大的 Windows 安装器
- 多个平台打包产物
- 大号依赖包

推荐两种免费替代：

### 1. GitHub Releases

适合：

- 版本化发布
- 给用户一个稳定的下载链接
- 公开项目直接分发大文件

### 2. Cloudflare R2

适合：

- 资源越来越多时统一管理
- 后面想接签名下载或更多分发控制

## 五、Windows 优先的分发建议

论坛里提到的建议非常适合安的爽：

- Windows 走封装好的傻瓜式包
- Linux 走脚本
- 页面根据 UA 自动识别并推荐正确入口

推荐做法：

### v1

- Windows：主按钮展示“一键体检器”和预置傻瓜包
- Linux：先展示“Linux 版本准备中”，同时给未来入口留位
- 页面自动识别平台，但保留手动切换入口

### v2

- Linux 增加 `.sh` 下载入口
- 把预置 Windows 包和 Linux 脚本统一归档到下载中心

## 六、UA 识别建议

UA 识别适合做“推荐”，不适合做“强制”。

推荐交互：

- 检测到 Windows：默认推荐 Windows 体检器和 Windows 傻瓜包
- 检测到 Linux：默认推荐 Linux 脚本入口
- 始终给一个“手动切换平台”入口

这样能避免小白搞不清楚 Windows / Linux 的概念，也不会把高级用户锁死。

## 七、安的爽的免费路线建议

如果按成本最低、成功率最高来排：

### 第一步

- 用 `Cloudflare Pages`
- 域名直接用 `andeshuang.pages.dev`
- LinuxDO 登录回调走 Pages Functions

### 第二步

- 小脚本和预置 Windows 包继续放 Pages
- 真正的大体积文件放 `GitHub Releases`

### 第三步

- 如果未来下载量和文件量上来，再考虑 `R2`
- 如果后端逻辑变重，再考虑单独 Workers

## 八、结论

对安的爽来说，最现实的免费组合是：

- 域名：先用 `pages.dev`
- 页面：Cloudflare Pages
- 回调：Cloudflare Pages Functions
- 小资源：Pages 静态目录
- 大文件：GitHub Releases
- 未来扩展：R2 / Workers

这套组合的好处是：

- 现在就能做
- 成本极低
- 跟当前前端项目最匹配
- 后面升级也不需要推翻重来
