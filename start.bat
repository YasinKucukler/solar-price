@echo off
chcp 65001 >nul
echo.
echo  *** GES-O Baslatiliyor ***
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo  [HATA] Node.js bulunamadi!
  echo  Lutfen https://nodejs.org adresinden Node.js LTS surumunu yukleyin.
  echo.
  pause
  exit /b 1
)

echo  Bagimliliklar kontrol ediliyor...
call npm install --silent
echo.

echo  Eski surec temizleniyor...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3131" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo  Sunucu baslatiliyor...
node server.js
