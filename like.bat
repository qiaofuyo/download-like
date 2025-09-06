@echo off
chcp 65001

rem --- 脚本功能：根据用户输入选择模式，若输入无效则默认以app模式运行 ---

:getUserInput
set /p "app_mode=选择运行模式 (y: app模式, n: pc模式): "

rem 第一步：优先判断用户是否选择了pc模式 (n/N)。
if /i "%app_mode%"=="n" (
    echo.
    echo 正在以 pc 模式启动...
    echo.
    node main.js %app_mode%
    goto :scriptEnd
)

rem 第二步：如果输入不是n/N，则一律视为app模式。
echo.
echo 无效输入或选择了 app 模式，将以 app 模式启动...
echo.
set "app_mode=y"
node main.js %app_mode%

:scriptEnd
echo.
echo 执行完成。
echo.
pause