#!/bin/bash

# Ollama Setup Script for TZBOT AI Auto-Reply
# This script helps you install and configure Ollama for local AI

set -e

echo "========================================="
echo "TZBOT AI Auto-Reply Setup"
echo "========================================="
echo ""

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
    OLLAMA_VERSION=$(ollama --version 2>&1 | head -n 1)
    echo "   Version: $OLLAMA_VERSION"
else
    echo "❌ Ollama is not installed"
    echo ""
    echo "Please install Ollama first:"
    echo "  - Linux: curl -fsSL https://ollama.ai/install.sh | sh"
    echo "  - macOS: brew install ollama"
    echo "  - Windows: Download from https://ollama.ai/download"
    echo ""
    exit 1
fi

echo ""
echo "========================================="
echo "Checking Ollama Service"
echo "========================================="

# Check if Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama service is running"
else
    echo "⚠️  Ollama service is not running"
    echo ""
    echo "Starting Ollama service..."
    echo "Run this in a separate terminal: ollama serve"
    echo ""
    read -p "Press Enter once Ollama is running..."
fi

echo ""
echo "========================================="
echo "Available Models"
echo "========================================="
echo ""
echo "Recommended models for 4GB RAM:"
echo "  1. llama3.2:1b    - Fastest, ~1GB (RECOMMENDED)"
echo "  2. phi3:mini      - Fast, ~2GB"
echo "  3. gemma2:2b      - Fast, ~1.5GB"
echo ""
echo "For 8GB+ RAM:"
echo "  4. llama3.2:3b    - Better quality, ~2GB"
echo "  5. llama3.1:8b    - Best quality, ~4.7GB"
echo ""

# Check installed models
echo "Currently installed models:"
ollama list

echo ""
read -p "Enter model number to download (1-5) or 's' to skip: " choice

case $choice in
    1)
        echo "Downloading llama3.2:1b..."
        ollama pull llama3.2:1b
        MODEL_NAME="llama3.2:1b"
        ;;
    2)
        echo "Downloading phi3:mini..."
        ollama pull phi3:mini
        MODEL_NAME="phi3:mini"
        ;;
    3)
        echo "Downloading gemma2:2b..."
        ollama pull gemma2:2b
        MODEL_NAME="gemma2:2b"
        ;;
    4)
        echo "Downloading llama3.2:3b..."
        ollama pull llama3.2:3b
        MODEL_NAME="llama3.2:3b"
        ;;
    5)
        echo "Downloading llama3.1:8b..."
        ollama pull llama3.1:8b
        MODEL_NAME="llama3.1:8b"
        ;;
    s|S)
        echo "Skipping model download"
        read -p "Enter model name to use: " MODEL_NAME
        ;;
    *)
        echo "Invalid choice. Using llama3.2:1b as default"
        MODEL_NAME="llama3.2:1b"
        ;;
esac

echo ""
echo "========================================="
echo "Testing Model"
echo "========================================="
echo ""
echo "Testing $MODEL_NAME..."
ollama run $MODEL_NAME "Say hello in one sentence" --verbose

echo ""
echo "========================================="
echo "Updating .env Configuration"
echo "========================================="
echo ""

# Update .env file
if [ -f .env ]; then
    echo "Updating .env file..."
    
    # Backup .env
    cp .env .env.backup
    
    # Update or add AI configuration
    if grep -q "AI_ENABLED=" .env; then
        sed -i "s/AI_ENABLED=.*/AI_ENABLED=true/" .env
    else
        echo "AI_ENABLED=true" >> .env
    fi
    
    if grep -q "AI_PROVIDER=" .env; then
        sed -i "s/AI_PROVIDER=.*/AI_PROVIDER=ollama/" .env
    else
        echo "AI_PROVIDER=ollama" >> .env
    fi
    
    if grep -q "AI_MODEL_NAME=" .env; then
        sed -i "s/AI_MODEL_NAME=.*/AI_MODEL_NAME=$MODEL_NAME/" .env
    else
        echo "AI_MODEL_NAME=$MODEL_NAME" >> .env
    fi
    
    if grep -q "AI_BASE_URL=" .env; then
        sed -i "s|AI_BASE_URL=.*|AI_BASE_URL=http://localhost:11434|" .env
    else
        echo "AI_BASE_URL=http://localhost:11434" >> .env
    fi
    
    echo "✅ .env file updated (backup saved as .env.backup)"
else
    echo "⚠️  .env file not found. Please copy .env.example to .env first"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Configuration:"
echo "  Provider: Ollama"
echo "  Model: $MODEL_NAME"
echo "  Base URL: http://localhost:11434"
echo ""
echo "Next steps:"
echo "  1. Make sure Ollama is running: ollama serve"
echo "  2. Rebuild the bot: npm run build"
echo "  3. Start the bot: npm start"
echo "  4. Test by mentioning the bot or using casino keywords"
echo ""
echo "Commands:"
echo "  /ai-status - Check AI system status"
echo "  /ai-clear-history - Clear conversation history"
echo ""
echo "For more information, see docs/AI_SETUP_GUIDE.md"
echo ""
