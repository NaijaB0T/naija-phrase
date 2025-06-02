@echo off
echo 🚨 DEPLOYING QUEUE-BASED PROCESSING FIX...
echo.
echo Problem: "Too many API requests by single worker invocation"
echo Solution: Queue-based processing for large videos
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
echo ✅ QUEUE-BASED PROCESSING DEPLOYED!
echo.
echo 🔧 NEW FEATURES:
echo    - Queue-based processing for large videos
echo    - Real-time chunk progress monitoring
echo    - Eliminates "Too many API requests" errors
echo    - Handles videos with 1000+ subtitles
echo.
echo 🎯 TEST THE FIX:
echo    1. Go to admin/videos page
echo    2. Find video OA9qyS-ODhc (or any large video)
echo    3. Click "Retry" button  
echo    4. Watch queue progress: "Queue processing (5/20 chunks)..."
echo    5. Should complete successfully!
echo.
echo 📊 Large videos now process via queue system:
echo    Small (^<100): Normal bulk processing
echo    Large (100+): Queue processing in 25-subtitle chunks
echo.
echo The rate limit error should be GONE! 🚀
echo.
pause
