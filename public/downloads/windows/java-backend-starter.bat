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
echo [安装] Git
echo [安装] Git >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install git -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Git
  echo [失败] Git >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Git
  echo [成功] Git >> "%LOGFILE%"
)
echo.
echo [安装] Visual Studio Code
echo [安装] Visual Studio Code >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install vscode -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Visual Studio Code
  echo [失败] Visual Studio Code >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Visual Studio Code
  echo [成功] Visual Studio Code >> "%LOGFILE%"
)
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
echo [安装] MySQL
echo [安装] MySQL >> "%LOGFILE%"
echo [提示] 安装后通常还需要初始化 root 密码和服务配置。
echo [提示] 安装后通常还需要初始化 root 密码和服务配置。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install mysql -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] MySQL
  echo [失败] MySQL >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] MySQL
  echo [成功] MySQL >> "%LOGFILE%"
)
echo.
echo [安装] Redis
echo [安装] Redis >> "%LOGFILE%"
echo [提示] Windows 环境下更适合作为本地开发依赖，正式生产建议使用 Linux 服务。
echo [提示] Windows 环境下更适合作为本地开发依赖，正式生产建议使用 Linux 服务。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call choco install redis-64 -y --no-progress >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Redis
  echo [失败] Redis >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Redis
  echo [成功] Redis >> "%LOGFILE%"
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
