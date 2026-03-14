@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title 编码测试

set "LOGFILE=%~dp0test-log.txt"

echo ===== 控制台输出测试 =====
echo [测试] 这是中文测试
echo [测试] Python 安装中...
echo.

echo ===== 日志文件测试 ===== > "%LOGFILE%"
echo [测试] 这是中文测试 >> "%LOGFILE%"
echo [测试] Python 安装中... >> "%LOGFILE%"
echo. >> "%LOGFILE%"

echo ===== 变量测试 =====
set "TEST_VAR=测试变量"
echo 变量内容: !TEST_VAR!
echo 变量内容: !TEST_VAR! >> "%LOGFILE%"
echo.

echo ===== PowerShell 测试 =====
powershell -NoProfile -Command "Write-Host '[PowerShell] 中文输出测试'"
powershell -NoProfile -Command "Write-Host '[PowerShell] 中文输出测试'" >> "%LOGFILE%" 2>&1
echo.

echo 测试完成。请检查以下内容：
echo 1. 控制台中文是否正常（可能乱码，这是正常的）
echo 2. 打开 test-log.txt 文件，检查日志中的中文是否正常
echo 3. 如果日志文件中文正常，说明脚本逻辑没问题，只是控制台显示问题
echo.
pause
