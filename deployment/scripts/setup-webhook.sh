#!/bin/bash
#
# Discord Webhook Setup Helper
# Interactive script to set up Discord webhook for CI/CD notifications
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

echo ""
echo "================================================"
echo "  Discord Webhook Setup for CI/CD Notifications"
echo "================================================"
echo ""

# Step 1: Instructions
log_step "Step 1: Create Discord Webhook"
echo ""
echo "Follow these steps in Discord:"
echo "  1. Go to your Discord server"
echo "  2. Right-click the channel where you want notifications"
echo "  3. Click 'Edit Channel'"
echo "  4. Go to 'Integrations' → 'Webhooks'"
echo "  5. Click 'New Webhook'"
echo "  6. Give it a name (e.g., 'TZBOT Deployments')"
echo "  7. Copy the Webhook URL"
echo ""
read -p "Press Enter when you have copied the webhook URL..."

# Step 2: Get webhook URL
log_step "Step 2: Enter Webhook URL"
echo ""
read -p "Paste your webhook URL here: " WEBHOOK_URL

# Validate webhook URL format
if [[ ! "$WEBHOOK_URL" =~ ^https://discord\.com/api/webhooks/[0-9]+/.+ ]]; then
    log_error "Invalid webhook URL format"
    echo ""
    echo "Expected format:"
    echo "  https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN"
    echo ""
    echo "Your input:"
    echo "  $WEBHOOK_URL"
    exit 1
fi

log_info "✅ Webhook URL format is valid"

# Step 3: Test webhook
log_step "Step 3: Testing Webhook"
echo ""
log_info "Sending test message to Discord..."

RESPONSE=$(curl -X POST \
    -H "Content-Type: application/json" \
    -d '{"content":"🧪 **Webhook Setup Test**\n\nIf you see this message, your webhook is working correctly!"}' \
    "$WEBHOOK_URL" \
    --silent \
    --write-out "\n%{http_code}" \
    --max-time 10)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    log_info "✅ Test message sent successfully!"
    echo ""
    log_info "Check your Discord channel - you should see a test message"
    echo ""
    read -p "Did you see the test message in Discord? (y/n): " CONFIRM
    
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        log_error "Test message not received. Please check:"
        echo "  - Webhook URL is correct"
        echo "  - Channel permissions allow webhooks"
        echo "  - Channel is not archived"
        exit 1
    fi
else
    log_error "Failed to send test message (HTTP $HTTP_CODE)"
    exit 1
fi

# Step 4: Save to GitHub Secrets
log_step "Step 4: Add to GitHub Secrets"
echo ""
echo "Now you need to add this webhook URL to GitHub repository secrets:"
echo ""
echo "  1. Go to your GitHub repository"
echo "  2. Click 'Settings' → 'Secrets and variables' → 'Actions'"
echo "  3. Click 'New repository secret'"
echo "  4. Name: DISCORD_WEBHOOK_URL"
echo "  5. Value: (paste the webhook URL)"
echo "  6. Click 'Add secret'"
echo ""

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    log_info "GitHub CLI detected!"
    echo ""
    read -p "Would you like to add the secret automatically using gh CLI? (y/n): " USE_GH
    
    if [[ "$USE_GH" =~ ^[Yy]$ ]]; then
        log_info "Adding secret to GitHub..."
        echo "$WEBHOOK_URL" | gh secret set DISCORD_WEBHOOK_URL
        
        if [ $? -eq 0 ]; then
            log_info "✅ Secret added successfully!"
        else
            log_error "Failed to add secret via gh CLI"
            log_info "Please add it manually following the instructions above"
        fi
    else
        log_info "Please add the secret manually following the instructions above"
    fi
else
    log_info "GitHub CLI not found. Please add the secret manually."
    echo ""
    echo "To install GitHub CLI: https://cli.github.com/"
fi

# Step 5: Save to local .env (optional)
echo ""
log_step "Step 5: Save to Local Environment (Optional)"
echo ""
read -p "Would you like to save this to your local .env file for testing? (y/n): " SAVE_LOCAL

if [[ "$SAVE_LOCAL" =~ ^[Yy]$ ]]; then
    if [ -f .env ]; then
        # Check if DISCORD_WEBHOOK_URL already exists
        if grep -q "^DISCORD_WEBHOOK_URL=" .env; then
            log_warn "DISCORD_WEBHOOK_URL already exists in .env"
            read -p "Overwrite existing value? (y/n): " OVERWRITE
            
            if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
                # Use sed to replace the line (cross-platform compatible)
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    sed -i '' "s|^DISCORD_WEBHOOK_URL=.*|DISCORD_WEBHOOK_URL=$WEBHOOK_URL|" .env
                else
                    # Linux
                    sed -i "s|^DISCORD_WEBHOOK_URL=.*|DISCORD_WEBHOOK_URL=$WEBHOOK_URL|" .env
                fi
                log_info "✅ Updated DISCORD_WEBHOOK_URL in .env"
            fi
        else
            # Add new line
            echo "" >> .env
            echo "# Discord Webhook for CI/CD Notifications" >> .env
            echo "DISCORD_WEBHOOK_URL=$WEBHOOK_URL" >> .env
            log_info "✅ Added DISCORD_WEBHOOK_URL to .env"
        fi
    else
        log_error ".env file not found"
        log_info "Creating .env from .env.example..."
        cp .env.example .env
        echo "" >> .env
        echo "# Discord Webhook for CI/CD Notifications" >> .env
        echo "DISCORD_WEBHOOK_URL=$WEBHOOK_URL" >> .env
        log_info "✅ Created .env with DISCORD_WEBHOOK_URL"
    fi
fi

# Step 6: Final test
echo ""
log_step "Step 6: Final Verification"
echo ""
log_info "Running comprehensive webhook test..."

export DISCORD_WEBHOOK_URL="$WEBHOOK_URL"
bash "$(dirname "$0")/test-webhook.sh" "$WEBHOOK_URL"

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    log_info "✅ Webhook Setup Complete!"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo "  1. Verify DISCORD_WEBHOOK_URL is in GitHub Secrets"
    echo "  2. Trigger a CI/CD workflow to test notifications"
    echo "  3. Check your Discord channel for deployment updates"
    echo ""
    echo "Documentation:"
    echo "  - Webhook Troubleshooting: docs/WEBHOOK_TROUBLESHOOTING.md"
    echo "  - CI/CD Review: docs/CICD_REVIEW.md"
    echo ""
else
    log_error "Webhook test failed"
    echo ""
    echo "Please review the errors above and try again"
    echo "For help, see: docs/WEBHOOK_TROUBLESHOOTING.md"
    exit 1
fi

exit 0
