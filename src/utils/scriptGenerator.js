import { getAllPackages } from '../data/environments.js'

export function generateScript(packageIds, options = {}) {
  const normalizedOptions =
    typeof options === 'boolean'
      ? { useChocolatey: options, mode: 'install' }
      : {
          useChocolatey: options.useChocolatey ?? true,
          mode: options.mode ?? 'install'
        }

  const allPackages = getAllPackages()
  const selectedPackages = packageIds
    .map((id) => allPackages.find((pkg) => pkg.id === id))
    .filter(Boolean)

  if (normalizedOptions.mode === 'uninstall') {
    return normalizedOptions.useChocolatey
      ? generateChocolateyBat(selectedPackages, 'uninstall')
      : generateScoopBat(selectedPackages, 'uninstall')
  }

  return normalizedOptions.useChocolatey
    ? generateChocolateyBat(selectedPackages, 'install')
    : generateScoopBat(selectedPackages, 'install')
}

function generateChocolateyBat(packages, mode) {
  const chocoPackages = packages.filter((pkg) => pkg.choco)
  const pipPackages = packages.filter((pkg) => pkg.installMethod === 'pip')
  const manualPackages = packages.filter((pkg) => pkg.installMethod === 'manual')
  const isInstall = mode === 'install'
  const operationText = isInstall ? '安装' : '卸载'
  const scriptTitle = isInstall ? '开发环境一键安装' : '开发环境后悔药'
  const packageAction = isInstall ? 'install' : 'uninstall'
  const logPrefix = isInstall ? 'install' : 'uninstall'
  const pipCommand = isInstall ? 'pip install' : 'pip uninstall -y'

  let bat = `@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - ${scriptTitle}
:: 生成时间: ${new Date().toLocaleString('zh-CN')}
:: 包管理器: Chocolatey
:: 模式: ${operationText}

set "LOGFILE=%~dp0andeshuang-${logPrefix}-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"
set /a FAILED_COUNT=0

>nul 2>&1 "%SYSTEMROOT%\\system32\\cacls.exe" "%SYSTEMROOT%\\system32\\config\\system"
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
cls

echo ===================================== > "%LOGFILE%"
echo 安的爽 ${operationText}日志 >> "%LOGFILE%"
echo 生成时间: ${new Date().toLocaleString('zh-CN')} >> "%LOGFILE%"
echo ===================================== >> "%LOGFILE%"
echo.
echo =====================================
echo      安的爽 - ${scriptTitle}
echo =====================================
echo 日志文件：%LOGFILE%
echo.

echo [检查] Chocolatey 是否已安装...
echo [检查] Chocolatey 是否已安装... >> "%LOGFILE%"
where choco >nul 2>nul
if %errorlevel% neq 0 (
  ${
    isInstall
      ? `echo [安装] 正在安装 Chocolatey...
echo [安装] 正在安装 Chocolatey... >> "%LOGFILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
  echo [失败] Chocolatey 安装失败，请检查网络、代理或管理员权限。
  echo [失败] Chocolatey 安装失败。>> "%LOGFILE%"
  pause
  exit /b 1
)
call refreshenv >nul 2>nul
echo [成功] Chocolatey 安装完成。
echo [成功] Chocolatey 安装完成。 >> "%LOGFILE%"`
      : `echo [失败] 未检测到 Chocolatey，无法继续卸载 Chocolatey 软件包。
echo [失败] 未检测到 Chocolatey。 >> "%LOGFILE%"
pause
exit /b 1`
  }
) else (
  echo [跳过] 已检测到 Chocolatey。
  echo [跳过] 已检测到 Chocolatey。 >> "%LOGFILE%"
)
echo.
`

  if (chocoPackages.length > 0) {
    bat += `echo [开始] ${operationText} Chocolatey 软件包...
echo [开始] ${operationText} Chocolatey 软件包... >> "%LOGFILE%"
echo.
`

    chocoPackages.forEach((pkg) => {
      bat += `echo [${operationText}] ${pkg.name}
echo [${operationText}] ${pkg.name} >> "%LOGFILE%"
choco ${packageAction} ${pkg.choco} -y --no-progress >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] ${pkg.name}
  echo [成功] ${pkg.name} >> "%LOGFILE%"
) else (
  echo [失败] ${pkg.name}
  echo [失败] ${pkg.name} >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.
`
    })
  }

  if (pipPackages.length > 0) {
    bat += `echo [开始] ${operationText} Python 扩展包...
echo [开始] ${operationText} Python 扩展包... >> "%LOGFILE%"
${isInstall ? 'pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOGFILE%" 2>&1' : 'echo [提示] 将使用 pip 执行卸载。 >> "%LOGFILE%"'}
echo.
`

    pipPackages.forEach((pkg) => {
      const pipArgs = isInstall
        ? pkg.command.replace(/^pip install\s+/i, '')
        : pkg.command
            .replace(/^pip install\s+/i, '')
            .split(/\s+/)
            .filter((token) => token && !token.startsWith('-'))
            .join(' ')

      bat += `echo [${operationText}] ${pkg.name}
echo [${operationText}] ${pkg.name} >> "%LOGFILE%"
${pipCommand} ${pipArgs} >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] ${pkg.name}
  echo [成功] ${pkg.name} >> "%LOGFILE%"
) else (
  echo [失败] ${pkg.name}
  echo [失败] ${pkg.name} >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.
`
    })
  }

  if (manualPackages.length > 0) {
    bat += `echo [提示] 以下软件需要手动${operationText}：
echo [提示] 以下软件需要手动${operationText}： >> "%LOGFILE%"
echo.
`

    manualPackages.forEach((pkg) => {
      bat += `echo ${pkg.name}
echo ${pkg.name} >> "%LOGFILE%"
echo 说明: ${pkg.description}
echo 说明: ${pkg.description} >> "%LOGFILE%"
echo 下载地址: ${pkg.url}
echo 下载地址: ${pkg.url} >> "%LOGFILE%"
${pkg.note ? `echo 注意: ${pkg.note}\necho 注意: ${pkg.note} >> "%LOGFILE%"` : ''}
echo.
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
  echo [建议] 失败排查：管理员权限、网络/代理、已有同名软件占用、包源不可用。 >> "%LOGFILE%"
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

function generateScoopBat(packages, mode) {
  const scoopPackages = packages.filter((pkg) => pkg.scoop)
  const pipPackages = packages.filter((pkg) => pkg.installMethod === 'pip')
  const manualPackages = packages.filter((pkg) => pkg.installMethod === 'manual')
  const isInstall = mode === 'install'
  const operationText = isInstall ? '安装' : '卸载'
  const scriptTitle = isInstall ? '开发环境一键安装' : '开发环境后悔药'
  const packageAction = isInstall ? 'install' : 'uninstall'
  const logPrefix = isInstall ? 'install' : 'uninstall'
  const pipCommand = isInstall ? 'pip install' : 'pip uninstall -y'

  let bat = `@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - ${scriptTitle}
:: 生成时间: ${new Date().toLocaleString('zh-CN')}
:: 包管理器: Scoop
:: 模式: ${operationText}

set "LOGFILE=%~dp0andeshuang-${logPrefix}-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"
set /a FAILED_COUNT=0

cls
echo ===================================== > "%LOGFILE%"
echo 安的爽 ${operationText}日志 >> "%LOGFILE%"
echo 生成时间: ${new Date().toLocaleString('zh-CN')} >> "%LOGFILE%"
echo ===================================== >> "%LOGFILE%"
echo.
echo =====================================
echo      安的爽 - ${scriptTitle}
echo =====================================
echo 日志文件：%LOGFILE%
echo.

echo [检查] Scoop 是否已安装...
echo [检查] Scoop 是否已安装... >> "%LOGFILE%"
where scoop >nul 2>nul
if %errorlevel% neq 0 (
  ${
    isInstall
      ? `echo [安装] 正在安装 Scoop...
echo [安装] 正在安装 Scoop... >> "%LOGFILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; irm get.scoop.sh | iex" >> "%LOGFILE%" 2>&1
if %errorlevel% neq 0 (
  echo [失败] Scoop 安装失败，请检查网络、代理或 PowerShell 执行策略。
  echo [失败] Scoop 安装失败。 >> "%LOGFILE%"
  pause
  exit /b 1
)
echo [成功] Scoop 安装完成。
echo [成功] Scoop 安装完成。 >> "%LOGFILE%"`
      : `echo [失败] 未检测到 Scoop，无法继续卸载 Scoop 软件包。
echo [失败] 未检测到 Scoop。 >> "%LOGFILE%"
pause
exit /b 1`
  }
) else (
  echo [跳过] 已检测到 Scoop。
  echo [跳过] 已检测到 Scoop。 >> "%LOGFILE%"
)
echo.

echo [配置] 检查 extras bucket...
echo [配置] 检查 extras bucket... >> "%LOGFILE%"
scoop bucket add extras >> "%LOGFILE%" 2>&1
echo.
`

  if (scoopPackages.length > 0) {
    bat += `echo [开始] ${operationText} Scoop 软件包...
echo [开始] ${operationText} Scoop 软件包... >> "%LOGFILE%"
echo.
`

    scoopPackages.forEach((pkg) => {
      bat += `echo [${operationText}] ${pkg.name}
echo [${operationText}] ${pkg.name} >> "%LOGFILE%"
scoop ${packageAction} ${pkg.scoop} >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] ${pkg.name}
  echo [成功] ${pkg.name} >> "%LOGFILE%"
) else (
  echo [失败] ${pkg.name}
  echo [失败] ${pkg.name} >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.
`
    })
  }

  if (pipPackages.length > 0) {
    bat += `echo [开始] ${operationText} Python 扩展包...
echo [开始] ${operationText} Python 扩展包... >> "%LOGFILE%"
${isInstall ? 'pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOGFILE%" 2>&1' : 'echo [提示] 将使用 pip 执行卸载。 >> "%LOGFILE%"'}
echo.
`

    pipPackages.forEach((pkg) => {
      const pipArgs = isInstall
        ? pkg.command.replace(/^pip install\s+/i, '')
        : pkg.command
            .replace(/^pip install\s+/i, '')
            .split(/\s+/)
            .filter((token) => token && !token.startsWith('-'))
            .join(' ')

      bat += `echo [${operationText}] ${pkg.name}
echo [${operationText}] ${pkg.name} >> "%LOGFILE%"
${pipCommand} ${pipArgs} >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] ${pkg.name}
  echo [成功] ${pkg.name} >> "%LOGFILE%"
) else (
  echo [失败] ${pkg.name}
  echo [失败] ${pkg.name} >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.
`
    })
  }

  if (manualPackages.length > 0) {
    bat += `echo [提示] 以下软件需要手动${operationText}：
echo [提示] 以下软件需要手动${operationText}： >> "%LOGFILE%"
echo.
`

    manualPackages.forEach((pkg) => {
      bat += `echo ${pkg.name}
echo ${pkg.name} >> "%LOGFILE%"
echo 说明: ${pkg.description}
echo 说明: ${pkg.description} >> "%LOGFILE%"
echo 下载地址: ${pkg.url}
echo 下载地址: ${pkg.url} >> "%LOGFILE%"
${pkg.note ? `echo 注意: ${pkg.note}\necho 注意: ${pkg.note} >> "%LOGFILE%"` : ''}
echo.
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
  echo [建议] 失败排查：网络/代理、PowerShell 权限、已有同名软件占用、包源不可用。 >> "%LOGFILE%"
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
