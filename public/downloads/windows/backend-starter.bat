@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - 开发环境一键安装
:: 脚本来源: 安的爽 Windows 预置包
:: 包管理器: Chocolatey
:: 模式: 安装

:: 使用 PowerShell 生成可靠的时间戳
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do set "TIMESTAMP=%%i"
set "LOGFILE=%~dp0andeshuang-install-%TIMESTAMP%.log"
set /a FAILED_COUNT=0
set "PIP_MIRROR_READY=0"

>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
  echo 正在请求管理员权限...
  goto UACPrompt
) else (
  goto GotAdmin
)

:UACPrompt
echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
"%temp%\getadmin.vbs"
exit /B

:GotAdmin
if exist "%temp%\getadmin.vbs" del "%temp%\getadmin.vbs"
pushd "%CD%"
CD /D "%~dp0"

echo [检查] Chocolatey 是否已安装...
where choco >nul 2>nul
if %errorlevel% neq 0 (
  echo [安装] 正在安装 Chocolatey...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
if %errorlevel% neq 0 (
  echo [失败] Chocolatey 安装失败，请检查网络、代理或管理员权限。
  pause
  exit /b 1
)
call refreshenv >nul 2>nul
echo [成功] Chocolatey 安装完成。
) else (
  echo [跳过] 已检测到 Chocolatey。
)
echo.
echo [检查] winget 是否可用...
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
cls
echo ===================================== > "%LOGFILE%"
echo 安的爽 安装日志 >> "%LOGFILE%"
echo 脚本来源: 安的爽 Windows 预置包 >> "%LOGFILE%"
echo ===================================== >> "%LOGFILE%"
echo.
echo =====================================
echo      安的爽 - 开发环境一键安装
echo =====================================
echo 日志文件：%LOGFILE%
echo.
echo [开始] 执行 安装流程...
echo [开始] 执行 安装流程... >> "%LOGFILE%"
echo.
echo [安装] Temurin JDK · 21 LTS 推荐
echo [安装] Temurin JDK · 21 LTS 推荐 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install temurin21jdk -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Temurin JDK · 21 LTS 推荐
  echo [失败] Temurin JDK · 21 LTS 推荐 >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Temurin JDK · 21 LTS 推荐
  echo [成功] Temurin JDK · 21 LTS 推荐 >> "%LOGFILE%"
)
echo.
echo [安装] .NET SDK · 10 LTS 推荐
echo [安装] .NET SDK · 10 LTS 推荐 >> "%LOGFILE%"
echo [提示] 使用 winget 安装 .NET SDK，版本会按官方渠道维护。
echo [提示] 使用 winget 安装 .NET SDK，版本会按官方渠道维护。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call winget install Microsoft.DotNet.SDK.10 --accept-source-agreements --accept-package-agreements --silent --disable-interactivity >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] .NET SDK · 10 LTS 推荐
  echo [失败] .NET SDK · 10 LTS 推荐 >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] .NET SDK · 10 LTS 推荐
  echo [成功] .NET SDK · 10 LTS 推荐 >> "%LOGFILE%"
)
echo.
echo [安装] Go
echo [安装] Go >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install golang -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Go
  echo [失败] Go >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Go
  echo [成功] Go >> "%LOGFILE%"
)
echo.

if %FAILED_COUNT% gtr 0 (
  echo =====================================
  echo 安装完成，但有 %FAILED_COUNT% 项失败。
  echo 请查看日志文件并根据提示重试。
  echo 日志路径：%LOGFILE%
  echo =====================================
  echo [建议] 失败排查：管理员权限、网络/代理、包源不可用、已有同名软件占用、需要手动确认的安装器。 >> "%LOGFILE%"
) else (
  echo =====================================
  echo 安装流程已完成。
  echo 日志路径：%LOGFILE%
  echo =====================================
)
pause >nul
