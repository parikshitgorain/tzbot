# Discord Text Restriction Bot

A Discord bot that restricts text in channels and allows only preset custom commands.

## Features
- Restrict channels to only allow specific commands
- Create custom commands with responses
- Automatically delete unauthorized messages
- Admin-only configuration commands

## Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Get bot token from Discord Developer Portal
3. Replace `YOUR_BOT_TOKEN` in `bot.py` with your actual token
4. Run: `python bot.py`

## Commands
- `!restrict_channel <command1> <command2>` - Restrict current channel to only allow specified commands
- `!shop_channel` - Restrict current channel to only allow shop commands (!buy, !shop)
- `!unrestrict_channel` - Remove restrictions from current channel
- `!add_command <name> <response>` - Add custom command
- `!remove_command <name>` - Remove custom command
- `!list_commands` - List all custom commands

## Usage Example
1. `!restrict_channel hello ping status` - Only allows messages starting with "hello", "ping", or "status"
2. `!add_command hello Hello there!` - Creates custom command that responds with "Hello there!"
3. Any other message in restricted channel gets deleted automatically