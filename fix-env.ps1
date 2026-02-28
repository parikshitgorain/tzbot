# Fix environment configuration on VPS
Write-Host "🔧 Fixing environment configuration on VPS..." -ForegroundColor Green

$VPS_HOST = "ocean"

Write-Host "`n📤 Uploading fix script..." -ForegroundColor Yellow
scp check-and-fix-env.sh ${VPS_HOST}:/tmp/

Write-Host "`n🚀 Running fix on VPS..." -ForegroundColor Yellow
ssh $VPS_HOST "chmod +x /tmp/check-and-fix-env.sh"
ssh $VPS_HOST "bash /tmp/check-and-fix-env.sh"

Write-Host "`n✅ Done! Check the output above for AI initialization." -ForegroundColor Green
Write-Host "Look for: 'AI provider initialized' with 'Groq'" -ForegroundColor Cyan
Write-Host "`nTest in Discord by mentioning the bot!" -ForegroundColor Yellow
