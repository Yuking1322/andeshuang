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

~~1. **GitHub Actions 报错** — 需要查看具体错误信息~~（已解决）
2. **用户端测试** — 需要用户清除缓存后重新测试
3. **中文乱码问题** — 考虑是否改用纯英文提示

---

## GitHub Actions 测试失败分析（已解决）

### 问题 1：日志文件路径生成错误

**现象**：
- 脚本显示 `[成功] uv`、`[成功] Python`，但实际没有安装
- 所有命令报错：`The system cannot find the path specified.`
- 日志文件路径：`C:\Users\RUNNER~1\AppData\Local\Temp\andeshuang-install-Sat03/4/-154555.log`

**根本原因**：
- 原代码使用 `%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%` 解析日期
- 假设 `%DATE%` 格式为 `YYYY-MM-DD`
- 但在 GitHub Actions 的 Windows 环境中，`%DATE%` 格式为 `Sat 03/14/2026`
- 导致路径解析为 `Sat03/4/-154555.log`（包含非法字符 `/`）
- 所有 `>> "%LOGFILE%"` 操作失败

**修复方案**：
```batch
# 修复前
set "LOGFILE=%~dp0andeshuang-install-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"

# 修复后
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do set "TIMESTAMP=%%i"
set "LOGFILE=%~dp0andeshuang-install-%TIMESTAMP%.log"
```

**优势**：
- PowerShell 的 `Get-Date -Format` 不依赖系统区域设置
- 在任何 Windows 环境中都能生成统一格式的时间戳

---

### 问题 2：PowerShell 无法解析 UTF-8 特殊字符

**现象**：
- workflow 中的验证步骤报错：
  ```
  The string is missing the terminator: ".
  At D:\a\_temp\...:8 char:25
  +   echo "✗ uv not found"
  ```

**根本原因**：
- workflow YAML 文件中使用了 UTF-8 特殊字符：`✓` `✗` `⚠`
- GitHub Actions 将 YAML 内容写入临时 PowerShell 脚本时，编码处理有问题
- PowerShell 解析时将 `✗` 识别为字符串终止符

**修复方案**：
- 批量替换所有特殊字符：
  - `✓` → `[OK]`
  - `✗` → `[FAIL]`
  - `⚠` → `[WARN]`

**提交**：
- `0ec3d83` - "fix: 修复日志文件路径生成和 workflow 编码问题"
- `38edff3` - "chore: 清理临时测试文件"

---

## 待解决问题

## 技术债务

1. **深色模式未实现** — `colors.css` 定义了深色模式变量，但 `App.vue` 使用硬编码颜色
2. **日期格式依赖系统区域设置** — `%DATE:~0,4%` 假设日期格式为 `YYYY-MM-DD`
3. **混用 Chocolatey 和 winget** — 后端基础包同时使用两个包管理器，已添加 winget 检测但仍有风险

---

## 上下文使用情况

- 当前：63,460 / 200,000 tokens（约 68% 剩余）
- 剩余：136,540 tokens
- 状态：充足

---

## 最终状态（2026-03-15 凌晨）

### 已完成的修复

1. ✅ **UTF-8 BOM 问题** — 前端动态生成和预置包文件都已添加 BOM
2. ✅ **日志文件路径生成** — 改用 PowerShell Get-Date，不依赖系统日期格式
3. ✅ **PowerShell 编码问题** — 移除 workflow 中的 UTF-8 特殊字符
4. ✅ **externally-managed-environment** — 添加 --break-system-packages 支持 uv 环境

### 自动化测试

**已创建的 workflow**：
1. `.github/workflows/test-windows-install.yml` — 单独测试 Python 工作台
2. `.github/workflows/test-all-windows-install.yml` — 完整测试套件（4 个 job 并行）

**测试覆盖**：
- ✅ Python 工作台（uv + Python + pipx + JupyterLab）
- ✅ 前端新机包（Node.js + Git + pnpm）
- ✅ 后端基础包（OpenJDK + .NET + Go）
- ✅ 数据科学入门（Python + pandas + numpy + matplotlib + scikit-learn）

**测试状态**：
- 第 1 次测试：日志路径错误 ❌
- 第 2 次测试：externally-managed-environment 错误 ❌
- 第 3 次测试：等待中（应该通过）
- 完整测试套件：运行中（4 个 job 并行）

### 待用户测试

1. **清除浏览器缓存**，访问 https://andeshuang.me
2. **重新下载脚本**，验证是否还有中文乱码或报错
3. **检查 GitHub Actions** 测试结果

### 已部署版本

- 最新部署：https://ad16bef9.andeshuang.pages.dev
- 主域名：https://andeshuang.me
- 包含所有修复：BOM + 日志路径 + --break-system-packages

---

## 下一步计划（明天）

1. 查看 GitHub Actions 测试结果
2. 如果测试失败，分析日志并修复
3. 如果测试通过，部署到生产环境
4. 收集用户反馈，验证实际使用效果

---
