#!/bin/bash
# Quick fix for stuck workers

echo "🚨 Deploying worker fixes..."
npm run build && npm run deploy

echo "✅ Worker fixes deployed!"
echo "🔧 Your videos should now process correctly with:"
echo "   - Smaller batch sizes (25 instead of 100)"
echo "   - Better error handling and fallbacks"
echo "   - Real-time monitoring capability"
echo ""
echo "📊 Add monitoring to admin panel by including WorkerMonitor.js"
echo "🔄 Videos currently stuck will retry automatically on next processing"
