# Deploy Groq AI to VPS from Windows
# Run this from your local Windows machine in PowerShell

Write-Host "🤖 Deploying Groq AI to VPS..." -ForegroundColor Green

# Configuration
$VPS_HOST = "ocean"
$GROQ_KEY = "YOUR_GROQ_API_KEY_HERE"

Write-Host "`n📤 Step 1: Uploading setup script to VPS..." -ForegroundColor Yellow

# Upload the fix script
scp fix-and-deploy-groq.sh ${VPS_HOST}:/tmp/

Write-Host "✅ Script uploaded" -ForegroundColor Green

Write-Host "`n🚀 Step 2: Making script executable on VPS..." -ForegroundColor Yellow

# Make script executable
ssh $VPS_HOST "chmod +x /tmp/fix-and-deploy-groq.sh"

Write-Host "`n🚀 Step 3: Running setup on VPS..." -ForegroundColor Yellow

# Execute script on VPS
ssh $VPS_HOST "bash /tmp/fix-and-deploy-groq.sh"

Write-Host "`n📋 Step 3: Checking logs..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Show logs
ssh $VPS_HOST "pm2 logs tzbot --lines 20 --nostream"

Write-Host "`n✅ Deployment complete! Test in Discord by mentioning the bot." -ForegroundColor Green
Write-Host "Expected response time: 1-2 seconds (was 60+ seconds)" -ForegroundColor Cyan
