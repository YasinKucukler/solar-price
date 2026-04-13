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

if not exist node_modules (
  echo  Bagimliliklar yukleniyor, bir dakika bekleyin...
  call npm install
  echo.
)

echo  Sunucu baslatiliyor...
node server.js
