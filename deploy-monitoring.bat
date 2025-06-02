@echo off
echo 🚀 DEPLOYING MONITORING...
echo.

npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed!
    pause
    exit /b %errorlevel%
)

npm run deploy
if %errorlevel% neq 0 (
    echo ❌ Deploy failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ MONITORING DEPLOYED!
echo.
echo 🎯 Go to your admin videos page to see real-time worker monitoring:
echo    https://naija-phrase.femivideograph.workers.dev/admin/videos
echo.
echo 📊 You'll now see:
echo    - Progress bars for processing videos
echo    - Live status updates every 3 seconds  
echo    - Stuck worker detection
echo    - Phrase count in real-time
echo.
pause
