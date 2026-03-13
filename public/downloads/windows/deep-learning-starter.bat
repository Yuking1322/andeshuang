@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - 开发环境一键安装
:: 生成时间: 2026/3/13 22:31:41
:: 包管理器: Chocolatey
:: 模式: 安装

set "LOGFILE=%~dp0andeshuang-install-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"
set /a FAILED_COUNT=0

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
cls

echo ===================================== > "%LOGFILE%"
echo 安的爽 安装日志 >> "%LOGFILE%"
echo 生成时间: 2026/3/13 22:31:41 >> "%LOGFILE%"
echo ===================================== >> "%LOGFILE%"
echo.
echo =====================================
echo      安的爽 - 开发环境一键安装
echo =====================================
echo 日志文件：%LOGFILE%
echo.

echo [检查] Chocolatey 是否已安装...
echo [检查] Chocolatey 是否已安装... >> "%LOGFILE%"
where choco >nul 2>nul
if %errorlevel% neq 0 (
  echo [安装] 正在安装 Chocolatey...
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
echo [成功] Chocolatey 安装完成。 >> "%LOGFILE%"
) else (
  echo [跳过] 已检测到 Chocolatey。
  echo [跳过] 已检测到 Chocolatey。 >> "%LOGFILE%"
)
echo.
echo [开始] 安装 Chocolatey 软件包...
echo [开始] 安装 Chocolatey 软件包... >> "%LOGFILE%"
echo.
echo [安装] Python 3.11
echo [安装] Python 3.11 >> "%LOGFILE%"
choco install python311 -y --no-progress >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] Python 3.11
  echo [成功] Python 3.11 >> "%LOGFILE%"
) else (
  echo [失败] Python 3.11
  echo [失败] Python 3.11 >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.
echo [开始] 安装 Python 扩展包...
echo [开始] 安装 Python 扩展包... >> "%LOGFILE%"
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple >> "%LOGFILE%" 2>&1
echo.
echo [安装] PyTorch
echo [安装] PyTorch >> "%LOGFILE%"
pip install torch torchvision torchaudio >> "%LOGFILE%" 2>&1
if %errorlevel% equ 0 (
  echo [成功] PyTorch
  echo [成功] PyTorch >> "%LOGFILE%"
) else (
  echo [失败] PyTorch
  echo [失败] PyTorch >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
)
echo.

if %FAILED_COUNT% gtr 0 (
  echo =====================================
  echo 安装完成，但有 %FAILED_COUNT% 项失败。
  echo 请查看日志文件并根据提示重试。
  echo 日志路径：%LOGFILE%
  echo =====================================
  echo [建议] 失败排查：管理员权限、网络/代理、已有同名软件占用、包源不可用。 >> "%LOGFILE%"
) else (
  echo =====================================
  echo 安装流程已完成。
  echo 日志路径：%LOGFILE%
  echo =====================================
)
pause >nul
