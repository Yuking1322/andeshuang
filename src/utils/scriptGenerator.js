import { resolvePackageConfig } from '../data/environments.js'

export function generateScript(packageIds, options = {}) {
  const normalizedOptions =
    typeof options === 'boolean'
      ? { useChocolatey: options, mode: 'install', sourceLabel: '动态脚本', selectedVersions: {} }
      : {
          useChocolatey: options.useChocolatey ?? true,
          mode: options.mode ?? 'install',
          sourceLabel: options.sourceLabel ?? '动态脚本',
          selectedVersions: options.selectedVersions ?? {}
        }

  const managerKey = normalizedOptions.useChocolatey ? 'chocolatey' : 'scoop'
  const resolvedPackages = packageIds
    .map((id) => resolvePackageConfig(id, normalizedOptions.selectedVersions))
    .filter(Boolean)

  return generateWindowsBat(resolvedPackages, {
    managerKey,
    mode: normalizedOptions.mode,
    sourceLabel: normalizedOptions.sourceLabel
  })
}

function generateWindowsBat(packages, options) {
  const isInstall = options.mode === 'install'
  const operationText = isInstall ? '安装' : '卸载'
  const scriptTitle = isInstall ? '开发环境一键安装' : '开发环境后悔药'
  const managerLabel = options.managerKey === 'chocolatey' ? 'Chocolatey' : 'Scoop'
  const logPrefix = isInstall ? 'install' : 'uninstall'
  const scriptSource = `安的爽 ${options.sourceLabel}`
  const executablePackages = []
  const manualPackages = []

  packages.forEach((pkg) => {
    const installer = pkg.managerActions?.[options.managerKey]
    const commands = isInstall ? installer?.installCommands || [] : installer?.uninstallCommands || []
    const displayName = pkg.selectedVersionLabel ? `${pkg.name} · ${pkg.selectedVersionLabel}` : pkg.name
    const note = installer?.note || pkg.note || ''
    const url = installer?.url || pkg.officialUrl || ''

    if (commands.length > 0) {
      executablePackages.push({
        id: pkg.id,
        displayName,
        commands,
        note
      })
      return
    }

    manualPackages.push({
      displayName,
      note: note || `当前模式下没有可直接执行的 ${operationText}命令。`,
      url
    })
  })

  const needsManagerBootstrap = executablePackages.some((pkg) =>
    pkg.commands.some((command) => {
      if (options.managerKey === 'chocolatey') {
        return /\bchoco\b/i.test(command)
      }

      return /\bscoop\b/i.test(command)
    })
  )

  const needsWinget = executablePackages.some((pkg) =>
    pkg.commands.some((command) => /\bwinget\b/i.test(command))
  )

  let bat = `@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - ${scriptTitle}
:: 脚本来源: ${scriptSource}
:: 包管理器: ${managerLabel}
:: 模式: ${operationText}

set "LOGFILE=%~dp0andeshuang-${logPrefix}-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"
set /a FAILED_COUNT=0
set "PIP_MIRROR_READY=0"

${needsManagerBootstrap ? buildManagerBootstrap(options.managerKey, isInstall) : 'pushd "%CD%"\nCD /D "%~dp0"\necho.\n'}${needsWinget ? buildWingetCheck() : ''}cls
echo ===================================== > "%LOGFILE%"
echo 安的爽 ${operationText}日志 >> "%LOGFILE%"
echo 脚本来源: ${scriptSource} >> "%LOGFILE%"
echo ===================================== >> "%LOGFILE%"
echo.
echo =====================================
echo      安的爽 - ${scriptTitle}
echo =====================================
echo 日志文件：%LOGFILE%
echo.
`

  if (executablePackages.length > 0) {
    bat += `echo [开始] 执行 ${operationText}流程...
echo [开始] 执行 ${operationText}流程... >> "%LOGFILE%"
echo.
`

    executablePackages.forEach((pkg) => {
      bat += `echo [${operationText}] ${pkg.displayName}
echo [${operationText}] ${pkg.displayName} >> "%LOGFILE%"
`

      if (pkg.note) {
        bat += `echo [提示] ${pkg.note}
echo [提示] ${pkg.note} >> "%LOGFILE%"
`
      }

      bat += `set "PACKAGE_FAILED="
`

      if (isInstall && pkg.commands.some((line) => /pip install/i.test(line))) {
        bat += `if "!PIP_MIRROR_READY!"=="0" (
  echo [配置] 正在设置 pip 镜像...
  echo [配置] 正在设置 pip 镜像... >> "%LOGFILE%"
  call powershell -NoProfile -Command "$py = if (Test-Path \\"$env:USERPROFILE\\\\.local\\\\bin\\\\python.exe\\") { \\"$env:USERPROFILE\\\\.local\\\\bin\\\\python.exe\\" } else { 'python' }; & $py -m pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple" >> "%LOGFILE%" 2>&1
  if !errorlevel! neq 0 (
    echo [提示] pip 镜像设置失败，将继续使用默认配置。
    echo [提示] pip 镜像设置失败。 >> "%LOGFILE%"
  )
  set "PIP_MIRROR_READY=1"
)
`
      }

      pkg.commands.forEach((command) => {
        bat += `call ${command} >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
`
      })

      bat += `if defined PACKAGE_FAILED (
  echo [失败] ${pkg.displayName}
  echo [失败] ${pkg.displayName} >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] ${pkg.displayName}
  echo [成功] ${pkg.displayName} >> "%LOGFILE%"
)
echo.
`
    })
  }

  if (manualPackages.length > 0) {
    bat += `echo [提示] 以下软件建议手动处理：
echo [提示] 以下软件建议手动处理： >> "%LOGFILE%"
echo.
`

    manualPackages.forEach((pkg) => {
      bat += `echo ${pkg.displayName}
echo ${pkg.displayName} >> "%LOGFILE%"
echo 说明: ${pkg.note}
echo 说明: ${pkg.note} >> "%LOGFILE%"
`

      if (pkg.url) {
        bat += `echo 官方入口: ${pkg.url}
echo 官方入口: ${pkg.url} >> "%LOGFILE%"
`
      }

      bat += `echo.
`
    })
  }

  bat += `
if %FAILED_COUNT% gtr 0 (
  echo =====================================
  echo ${operationText}完成，但有 %FAILED_COUNT% 项失败。
  echo 请查看日志文件并根据提示重试。
  echo 日志路径：%LOGFILE%
  echo =====================================
  echo [建议] 失败排查：管理员权限、网络/代理、包源不可用、已有同名软件占用、需要手动确认的安装器。 >> "%LOGFILE%"
) else (
  echo =====================================
  echo ${operationText}流程已完成。
  echo 日志路径：%LOGFILE%
  echo =====================================
)
pause >nul
`

  return bat
}

function buildManagerBootstrap(managerKey, isInstall) {
  if (managerKey === 'chocolatey') {
    return `>nul 2>&1 "%SYSTEMROOT%\\system32\\cacls.exe" "%SYSTEMROOT%\\system32\\config\\system"
if '%errorlevel%' NEQ '0' (
  echo 正在请求管理员权限...
  goto UACPrompt
) else (
  goto GotAdmin
)

:UACPrompt
echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\\getadmin.vbs"
echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\\getadmin.vbs"
"%temp%\\getadmin.vbs"
exit /B

:GotAdmin
if exist "%temp%\\getadmin.vbs" del "%temp%\\getadmin.vbs"
pushd "%CD%"
CD /D "%~dp0"

echo [检查] Chocolatey 是否已安装...
where choco >nul 2>nul
if %errorlevel% neq 0 (
  ${
    isInstall
      ? `echo [安装] 正在安装 Chocolatey...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
if %errorlevel% neq 0 (
  echo [失败] Chocolatey 安装失败，请检查网络、代理或管理员权限。
  pause
  exit /b 1
)
call refreshenv >nul 2>nul
echo [成功] Chocolatey 安装完成。`
      : `echo [失败] 未检测到 Chocolatey，无法继续卸载以 Chocolatey 为主的软件。
pause
exit /b 1`
  }
) else (
  echo [跳过] 已检测到 Chocolatey。
)
echo.
`
  }

  return `pushd "%CD%"
CD /D "%~dp0"

echo [检查] Scoop 是否已安装...
where scoop >nul 2>nul
if %errorlevel% neq 0 (
  ${
    isInstall
      ? `echo [安装] 正在安装 Scoop...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; irm get.scoop.sh | iex"
if %errorlevel% neq 0 (
  echo [失败] Scoop 安装失败，请检查网络、代理或 PowerShell 执行策略。
  pause
  exit /b 1
)
echo [成功] Scoop 安装完成。`
      : `echo [失败] 未检测到 Scoop，无法继续卸载以 Scoop 为主的软件。
pause
exit /b 1`
  }
) else (
  echo [跳过] 已检测到 Scoop。
)
echo.
`
}

function buildWingetCheck() {
  return `echo [检查] winget 是否可用...
where winget >nul 2>nul
if %errorlevel% neq 0 (
  echo [警告] 未检测到 winget，某些软件可能无法安装。
  echo [提示] winget 在 Windows 10 1809+ 和 Windows 11 上默认可用。
  echo [提示] 如需安装 winget，请访问 Microsoft Store 搜索"应用安装程序"。
  echo.
  pause
  exit /b 1
) else (
  echo [跳过] 已检测到 winget。
)
echo.
`
}
