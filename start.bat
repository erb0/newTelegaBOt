@echo off
echo Запуск бота через PM2...
call npm run pm2-start

echo Open logs...
pm2 logs bot
pause
