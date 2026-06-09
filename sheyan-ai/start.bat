@echo off
cd /d "%~dp0"
echo 正在启动设研AI开发服务器...
echo 启动后请访问: http://localhost:3000/login
echo 管理后台: http://localhost:3000/admin/login
echo.
echo 按 Ctrl+C 可停止服务器
echo.
npx next dev -H 127.0.0.1 -p 3000
pause
