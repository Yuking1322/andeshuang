# 调试记录 - 2026-03-14 晚间

本文档记录 2026-03-14 晚间发现用户报错后的调试过程和解决方案。

---

## 问题发现

### 用户报错 1：动态生成的脚本运行失败

**时间**：2026-03-14 晚间

**现象**：
- 用户在页面上勾选 Python，点击"生成安装脚本"并下载
- 运行 .bat 文件后报错：
  ```
  'LOGFILE' 不是内部或外部命令
  'on' 不是内部或外部命令
  'echo' 不是内部或外部命令
  'ensurepath' 不是内部或外部命令
  ```

**根本原因**：
- 动态生成的 BAT 文件没有 UTF-8 BOM
- Windows CMD 将无 BOM 的 UTF-8 文件当成 ANSI 编码解析
- 脚本中的中文字符被错误解析，导致整个脚本结构崩溃

**修复方案**：
- 修改 `src/components/EnvironmentSelector.vue` 的 `downloadTextFile()` 函数
- 在生成 Blob 时添加 UTF-8 BOM（`0xEF 0xBB 0xBF`）
- 提交：`ffa0eae` - "fix: 动态生成的 BAT 文件添加 UTF-8 BOM"

---

### 用户报错 2：预置包文件也有同样问题

**时间**：2026-03-14 晚间

**现象**：
- 通过代码审查发现，`public/downloads/windows/` 下所有 7 个预置包文件都没有 UTF-8 BOM
- 用户直接下载预置包也会遇到同样的编码问题

**根本原因**：
- `scripts/generate-downloads.mjs` 使用 `writeFile(filePath, content, 'utf8')` 写入文件
- Node.js 的 `writeFile` 默认不添加 BOM

**修复方案**：
- 修改 `generate-downloads.mjs`，在写入文件前添加 BOM：
  ```javascript
  const bom = Buffer.from([0xef, 0xbb, 0xbf])
  const body = Buffer.from(content, 'utf8')
  const combined = Buffer.concat([bom, body])
  await writeFile(filePath, combined)
  ```
- 重新生成所有预置包文件
- 验证文件前 3 字节为 `ef bb bf`
- 提交：`72f400a` - "fix: 为所有预置包文件添加 UTF-8 BOM"

---

### 用户报错 3：修复后仍有中文乱码

**时间**：2026-03-14 晚间

**现象**：
- 用户运行新下载的脚本后，控制台仍显示中文乱码
- 错误信息如 `[度梯道]`、`?缓?揭??缓?`
- 甚至出现 `'ACKAGE_FAILED'` 缺少开头 `P` 的情况

**分析**：
1. **控制台显示乱码是正常的** — 即使有 UTF-8 BOM，Windows CMD 的 `echo` 输出到控制台时仍会按 GBK 显示
2. **但脚本逻辑不应该失败** — 实际的安装命令（如 `powershell -Command "irm ..."`）都是英文，不包含中文
3. **`'ACKAGE_FAILED'` 缺少 `P`** — 说明 BOM 可能被当成了一个字符，或者用户下载的是旧版本

**可能原因**：
- 用户浏览器缓存了旧版本的脚本
- 或者 Cloudflare Pages 的 CDN 缓存未更新

**建议用户操作**：
1. 清除浏览器缓存
2. 强制刷新页面（Ctrl + F5）
3. 重新下载脚本
4. 运行新下载的脚本

---

## 自动化测试方案

### GitHub Actions 集成

**时间**：2026-03-14 晚间

**目的**：
- 在真实的 Windows Server 2022 环境中自动测试安装脚本
- 避免依赖用户反馈，提前发现问题
- 每次代码提交自动运行测试

**实现**：
- 创建 `.github/workflows/test-windows-install.yml`
- 测试内容：
  1. 检查文件是否有 UTF-8 BOM
  2. 运行 python-workbench.bat 安装脚本
  3. 验证 uv, Python, pipx, JupyterLab 是否成功安装
  4. 失败时自动上传日志文件
- 提交：`afcb021` - "ci: 添加 Windows 安装脚本自动化测试"

**优势**：
- ✅ 完全免费（公开仓库）
- ✅ 真实 Windows 环境（Windows Server 2022）
- ✅ 可重复测试
- ✅ 自动化，无需人工干预

**限制**：
- ❌ 无法测试需要图形界面的软件（VS Code, Docker Desktop）
- ❌ 无法测试需要 GPU 的深度学习工具
- ❌ 2C7G 配置，无法同时运行多个重量级软件

**当前状态**：
- workflow 已创建并推送到 GitHub
- 等待 GitHub Actions 运行结果
- 用户报告"现在好像就报错了"，需要查看具体错误信息

---

## 待解决问题

1. **GitHub Actions 报错** — 需要查看具体错误信息
2. **用户端测试** — 需要用户清除缓存后重新测试
3. **中文乱码问题** — 考虑是否改用纯英文提示

---

## 技术债务

1. **深色模式未实现** — `colors.css` 定义了深色模式变量，但 `App.vue` 使用硬编码颜色
2. **日期格式依赖系统区域设置** — `%DATE:~0,4%` 假设日期格式为 `YYYY-MM-DD`
3. **混用 Chocolatey 和 winget** — 后端基础包同时使用两个包管理器，已添加 winget 检测但仍有风险

---

## 上下文使用情况

- 当前：65,525 / 200,000 tokens（约 67%）
- 剩余：134,475 tokens
- 建议：继续调试，上下文充足

---

## 下一步计划

1. 查看 GitHub Actions 的具体错误信息
2. 根据错误修复 workflow 或脚本
3. 让用户清除缓存后重新测试
4. 如果问题持续，考虑改用纯英文提示或 PowerShell 脚本
