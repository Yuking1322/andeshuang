@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 安的爽 - 开发环境一键安装
:: 脚本来源: 安的爽 Windows 预置包
:: 包管理器: Chocolatey
:: 模式: 安装

set "LOGFILE=%~dp0andeshuang-install-%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%-%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "LOGFILE=%LOGFILE: =0%"
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
echo [安装] pipx
echo [安装] pipx >> "%LOGFILE%"
echo [提示] 需要当前系统已经能调用 python。
echo [提示] 需要当前系统已经能调用 python。 >> "%LOGFILE%"
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
call powershell -NoProfile -Command "$py = if (Test-Path \"$env:USERPROFILE\\.local\\bin\\python.exe\") { \"$env:USERPROFILE\\.local\\bin\\python.exe\" } else { 'python' }; & $py -m pip install --user pipx" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
call powershell -NoProfile -Command "$py = if (Test-Path \"$env:USERPROFILE\\.local\\bin\\python.exe\") { \"$env:USERPROFILE\\.local\\bin\\python.exe\" } else { 'python' }; & $py -m pipx ensurepath" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] pipx
  echo [失败] pipx >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] pipx
  echo [成功] pipx >> "%LOGFILE%"
)
echo.
echo [安装] JupyterLab
echo [安装] JupyterLab >> "%LOGFILE%"
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
call powershell -NoProfile -Command "$py = if (Test-Path \"$env:USERPROFILE\\.local\\bin\\python.exe\") { \"$env:USERPROFILE\\.local\\bin\\python.exe\" } else { 'python' }; & $py -m pip install jupyterlab" >> "%LOGFILE%" 2>&1
if !errorlevel! neq 0 set "PACKAGE_FAILED=1"
if defined PACKAGE_FAILED (
  echo [失败] JupyterLab
  echo [失败] JupyterLab >> "%LOGFILE%"
  set /a FAILED_COUNT+=1
) else (
  echo [成功] JupyterLab
  echo [成功] JupyterLab >> "%LOGFILE%"
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
