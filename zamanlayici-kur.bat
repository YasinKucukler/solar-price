@echo off
chcp 65001 >nul
echo.
echo  *** GES-O Otomatik Fiyat Guncelleyici Kurulumu ***
echo.
echo  Her gun saat 11:00'de otomatik guncelleme yapilacak.
echo.

set SCRIPT_DIR=%~dp0
set TASK=GES-O Fiyat Guncelleme

:: Eski gorevleri temizle
schtasks /delete /tn "%TASK% Sabah" /f >nul 2>&1
schtasks /delete /tn "%TASK% Aksam" /f >nul 2>&1
schtasks /delete /tn "%TASK%" /f >nul 2>&1

:: Her gun 11:00
schtasks /create /tn "%TASK%" /tr "node \"%SCRIPT_DIR%update-prices.js\"" /sc daily /st 11:00 /f /rl highest >nul 2>&1

if %ERRORLEVEL% equ 0 (
  echo  Zamanlayici kuruldu!
  echo  Her gun 11:00'de calisacak.
  echo  Bilgisayar kapali idiyse bir sonraki gun 11:00'de devreye girer.
  echo.
  echo  Guncelleme gecmisini gormek icin: update-log.txt
) else (
  echo  Hata! Yonetici olarak calistirin:
  echo  Bu dosyaya sag tiklayin - "Yonetici olarak calistir"
)
echo.
pause
