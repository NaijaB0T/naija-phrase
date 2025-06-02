@echo off
echo 🚨 Deploying worker fixes...
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
echo ✅ Worker fixes deployed successfully!
echo.
echo 🔧 Changes applied:
echo    - Reduced batch size from 100 to 25 entries
echo    - Added better error handling and fallbacks
echo    - Conservative approach for Cloudflare D1 limits
echo.
echo 📊 Next steps:
echo    1. Check your admin panel - stuck videos should retry automatically
echo    2. Add WorkerMonitor.js to admin page for real-time monitoring
echo    3. Future processing should be much more reliable
echo.
pause
