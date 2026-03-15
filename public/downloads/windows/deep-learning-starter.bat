@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - 开发环境一键安装
:: 脚本来源: 安的爽 Windows 预置包
:: 包管理器: Chocolatey
:: 模式: 安装
:: 更新时间: 2026-03-15

:: 使用 PowerShell 生成可靠的时间戳
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyyMMdd-HHmmss'"') do set "TIMESTAMP=%%i"
set "LOGFILE=%~dp0andeshuang-install-%TIMESTAMP%.log"
set /a FAILED_COUNT=0
set "PIP_MIRROR_READY=0"

pushd "%CD%"
CD /D "%~dp0"
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
echo [安装] uv
echo [安装] uv >> "%LOGFILE%"
echo [提示] uv 使用官方安装脚本，安装后可直接管理 Python 与依赖。
echo [提示] uv 使用官方安装脚本，安装后可直接管理 Python 与依赖。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] uv
  echo [失败] uv >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] uv
  echo [成功] uv >> "%LOGFILE%"
)
echo.
echo [安装] Python · 3.13 推荐
echo [安装] Python · 3.13 推荐 >> "%LOGFILE%"
echo [提示] Python 版本通过 uv 管理，适合需要多版本切换的开发环境。
echo [提示] Python 版本通过 uv 管理，适合需要多版本切换的开发环境。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
call powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://astral.sh/uv/install.ps1 | iex" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
call "%USERPROFILE%\.local\bin\uv.exe" python install 3.13 --default >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] Python · 3.13 推荐
  echo [失败] Python · 3.13 推荐 >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] Python · 3.13 推荐
  echo [成功] Python · 3.13 推荐 >> "%LOGFILE%"
)
echo.
echo [安装] PyTorch
echo [安装] PyTorch >> "%LOGFILE%"
echo [提示] 默认安装 CPU 版本；如需 CUDA，请在官方安装页选择精确命令。
echo [提示] 默认安装 CPU 版本；如需 CUDA，请在官方安装页选择精确命令。 >> "%LOGFILE%"
set "PACKAGE_FAILED="
if "!PIP_MIRROR_READY!"=="0" (
  echo [配置] 正在设置 pip 镜像...
  echo [配置] 正在设置 pip 镜像... >> "%LOGFILE%"
  call powershell -NoProfile -Command "$py = if (Test-Path \"$env:USERPROFILE\\.local\\bin\\python.exe\") { \"$env:USERPROFILE\\.local\\bin\\python.exe\" } else { 'python' }; & $py -m pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple" >> "%LOGFILE%" 2>&1
  if !errorlevel! neq 0 (
    echo [提示] pip 镜像设置失败，将继续使用默认配置。
    echo [提示] pip 镜像设置失败。 >> "%LOGFILE%"
  )
  set "PIP_MIRROR_READY=1"
)
call powershell -NoProfile -Command "$py = if (Test-Path \"$env:USERPROFILE\\.local\\bin\\python.exe\") { \"$env:USERPROFILE\\.local\\bin\\python.exe\" } else { 'python' }; & $py -m pip install torch torchvision torchaudio" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] PyTorch
  echo [失败] PyTorch >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] PyTorch
  echo [成功] PyTorch >> "%LOGFILE%"
)
echo.
echo [提示] 以下软件建议手动处理：
echo [提示] 以下软件建议手动处理： >> "%LOGFILE%"
echo.
echo Ollama
echo Ollama >> "%LOGFILE%"
echo 说明: 建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。
echo 说明: 建议使用 Ollama 官方 Windows 安装器，装完后再按需下载模型。 >> "%LOGFILE%"
echo 官方入口: https://ollama.com/download/windows
echo 官方入口: https://ollama.com/download/windows >> "%LOGFILE%"
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
