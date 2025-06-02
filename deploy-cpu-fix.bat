@echo off
echo 🚨 DEPLOYING CPU TIMEOUT FIX...
echo.
echo Problem: Worker exceeded CPU time limit on video jdn_C6RNoZU
echo Solution: Ultra-conservative processing with CPU time management
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
echo ✅ CPU TIMEOUT FIX DEPLOYED!
echo.
echo 🔧 Changes applied:
echo    - CPU time monitoring (8s limit)
echo    - Ultra-small batches (10 entries)
echo    - Chunked processing for large videos
echo    - INSERT OR IGNORE for efficiency
echo    - Partial processing with retry
echo.
echo 🎯 Test the fix:
echo    1. Go to admin/videos
echo    2. Retry processing jdn_C6RNoZU
echo    3. Should now complete or show partial progress
echo.
echo The "Worker exceeded CPU time limit" error should be gone!
echo.
pause
