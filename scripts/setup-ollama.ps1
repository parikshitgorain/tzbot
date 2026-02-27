# Ollama Setup Script for TZBOT AI Auto-Reply (Windows PowerShell)
# This script helps you install and configure Ollama for local AI

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "TZBOT AI Auto-Reply Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is installed
$ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue

if ($ollamaInstalled) {
    Write-Host "✅ Ollama is already installed" -ForegroundColor Green
    $version = ollama --version 2>&1 | Select-Object -First 1
    Write-Host "   Version: $version" -ForegroundColor Gray
} else {
    Write-Host "❌ Ollama is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Ollama first:" -ForegroundColor Yellow
    Write-Host "  - Download from: https://ollama.ai/download" -ForegroundColor Yellow
    Write-Host "  - Or use winget: winget install Ollama.Ollama" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Checking Ollama Service" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if Ollama is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Ollama service is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama service is not running" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ollama should start automatically. If not, run: ollama serve" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter once Ollama is running"
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Available Models" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recommended models for 4GB RAM:" -ForegroundColor Yellow
Write-Host "  1. llama3.2:1b    - Fastest, ~1GB (RECOMMENDED)" -ForegroundColor White
Write-Host "  2. phi3:mini      - Fast, ~2GB" -ForegroundColor White
Write-Host "  3. gemma2:2b      - Fast, ~1.5GB" -ForegroundColor White
Write-Host ""
Write-Host "For 8GB+ RAM:" -ForegroundColor Yellow
Write-Host "  4. llama3.2:3b    - Better quality, ~2GB" -ForegroundColor White
Write-Host "  5. llama3.1:8b    - Best quality, ~4.7GB" -ForegroundColor White
Write-Host ""

# Check installed models
Write-Host "Currently installed models:" -ForegroundColor Cyan
ollama list

Write-Host ""
$choice = Read-Host "Enter model number to download (1-5) or 's' to skip"

$modelName = ""
switch ($choice) {
    "1" {
        Write-Host "Downloading llama3.2:1b..." -ForegroundColor Yellow
        ollama pull llama3.2:1b
        $modelName = "llama3.2:1b"
    }
    "2" {
        Write-Host "Downloading phi3:mini..." -ForegroundColor Yellow
        ollama pull phi3:mini
        $modelName = "phi3:mini"
    }
    "3" {
        Write-Host "Downloading gemma2:2b..." -ForegroundColor Yellow
        ollama pull gemma2:2b
        $modelName = "gemma2:2b"
    }
    "4" {
        Write-Host "Downloading llama3.2:3b..." -ForegroundColor Yellow
        ollama pull llama3.2:3b
        $modelName = "llama3.2:3b"
    }
    "5" {
        Write-Host "Downloading llama3.1:8b..." -ForegroundColor Yellow
        ollama pull llama3.1:8b
        $modelName = "llama3.1:8b"
    }
    {$_ -in "s", "S"} {
        Write-Host "Skipping model download" -ForegroundColor Yellow
        $modelName = Read-Host "Enter model name to use"
    }
    default {
        Write-Host "Invalid choice. Using llama3.2:1b as default" -ForegroundColor Yellow
        $modelName = "llama3.2:1b"
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Testing Model" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing $modelName..." -ForegroundColor Yellow
ollama run $modelName "Say hello in one sentence"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Updating .env Configuration" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Update .env file
if (Test-Path .env) {
    Write-Host "Updating .env file..." -ForegroundColor Yellow
    
    # Backup .env
    Copy-Item .env .env.backup -Force
    
    # Read .env content
    $envContent = Get-Content .env
    
    # Update or add AI configuration
    $updates = @{
        "AI_ENABLED" = "true"
        "AI_PROVIDER" = "ollama"
        "AI_MODEL_NAME" = $modelName
        "AI_BASE_URL" = "http://localhost:11434"
    }
    
    foreach ($key in $updates.Keys) {
        $value = $updates[$key]
        $pattern = "^$key="
        
        if ($envContent -match $pattern) {
            $envContent = $envContent -replace "$pattern.*", "$key=$value"
        } else {
            $envContent += "`n$key=$value"
        }
    }
    
    # Write back to .env
    $envContent | Set-Content .env
    
    Write-Host "✅ .env file updated (backup saved as .env.backup)" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found. Please copy .env.example to .env first" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Provider: Ollama" -ForegroundColor White
Write-Host "  Model: $modelName" -ForegroundColor White
Write-Host "  Base URL: http://localhost:11434" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Make sure Ollama is running (should auto-start)" -ForegroundColor White
Write-Host "  2. Rebuild the bot: npm run build" -ForegroundColor White
Write-Host "  3. Start the bot: npm start" -ForegroundColor White
Write-Host "  4. Test by mentioning the bot or using casino keywords" -ForegroundColor White
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  /ai-status - Check AI system status" -ForegroundColor White
Write-Host "  /ai-clear-history - Clear conversation history" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see docs/AI_SETUP_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
