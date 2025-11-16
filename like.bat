@echo off
setlocal EnableDelayedExpansion
chcp 65001 > $null

rem --- 脚本功能：根据用户输入选择模式，若输入无效则直接退出。执行完毕后可重复使用 ---

rem --- 设置 ANSI 颜色代码 ---
if not "%AnsiColorEnabled%"=="1" (
    rem 启用虚拟终端处理
    ver | findstr /i "10." > nul && (
        reg query "HKCU\Console" /v VirtualTerminalLevel > nul || (
            reg add "HKCU\Console" /v VirtualTerminalLevel /t REG_DWORD /d 1 /f
        )
    )
    set "RESET_COLOR=[0m"
    set "RED=[31m"
    set "GREEN=[32m"
    set "YELLOW=[33m"
    set "AnsiColorEnabled=1"
)

:loop_start
set "app_mode="
rem set /p "app_mode=请选择运行模式 (y: app模式, n: pc模式, q: 退出脚本): "
set /p "=%YELLOW%请选择运行模式 (y: app模式, n: pc模式, q: 退出脚本): %RESET_COLOR%" <nul

rem 使用 PowerShell 实时监听单个按键
for /f %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$key = [console]::ReadKey($true); echo $key.keychar"') do (
    set "app_mode=%%a"
)

rem 检查是否为退出指令。
if /i "%app_mode%"=="q" (
    goto :close_win
)

rem 检查输入是否有效（y或n）。
if /i not "%app_mode%"=="y" if /i not "%app_mode%"=="n" (
    cls
    goto :loop_start
)

rem 根据已验证的输入执行脚本。
cls
echo %GREEN%正在以 %app_mode% 模式启动...%RESET_COLOR%
echo.
node --env-file-if-exists=.env main.js %app_mode%
echo.
goto :loop_start

:close_win
endlocal