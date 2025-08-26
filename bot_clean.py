import discord
from discord.ext import commands
import json
import os
import asyncio
from keep_alive import keep_alive

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents, help_command=None)

# Data files
RESTRICTED_CHANNELS_FILE = 'restricted_channels.json'
CUSTOM_COMMANDS_FILE = 'custom_commands.json'
WHITELIST_FILE = 'whitelist.json'

def load_data(filename):
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return json.load(f)
    return {}

def save_data(filename, data):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

# Load data
restricted_channels = load_data(RESTRICTED_CHANNELS_FILE)
custom_commands = load_data(CUSTOM_COMMANDS_FILE)
whitelist_users = load_data(WHITELIST_FILE)

@bot.event
async def on_ready():
    print(f'{bot.user} is online!')

@bot.command()
@commands.has_permissions(administrator=True)
async def restrict_channel(ctx, *, commands_text):
    """Restrict current channel to only allow specified commands"""
    if not commands_text:
        await ctx.send('Please provide commands to allow. Example: `!restrict_channel "!buy 5" "!buy 10" !shop`')
        return
    
    # Split by quotes to handle commands with spaces
    import shlex
    try:
        commands = shlex.split(commands_text)
    except:
        # Fallback to simple split if shlex fails
        commands = commands_text.split()
    
    channel_id = str(ctx.channel.id)
    restricted_channels[channel_id] = commands
    save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
    
    await ctx.send(f"Channel restricted. Only these commands are allowed: {', '.join(commands)}")

@bot.command()
@commands.has_permissions(administrator=True)
async def unrestrict_channel(ctx):
    """Remove restrictions from current channel"""
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels:
        del restricted_channels[channel_id]
        save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
        await ctx.send("Channel restrictions removed.")
    else:
        await ctx.send("This channel is not restricted.")

@bot.command()
@commands.has_permissions(administrator=True)
async def check_restrictions(ctx):
    """Check if current channel is restricted"""
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels:
        allowed = ', '.join(restricted_channels[channel_id])
        await ctx.send(f"This channel is restricted. Allowed: {allowed}")
    else:
        await ctx.send("This channel is not restricted.")

@bot.command()
@commands.has_permissions(administrator=True)
async def add_allowed_cmd(ctx, command):
    """Add a command to the restriction list for current channel"""
    channel_id = str(ctx.channel.id)
    if channel_id not in restricted_channels:
        restricted_channels[channel_id] = []
    
    if command not in restricted_channels[channel_id]:
        restricted_channels[channel_id].append(command)
        save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
        await ctx.send(f"Added '{command}' to allowed commands.")
    else:
        await ctx.send(f"'{command}' is already allowed.")

@bot.command()
@commands.has_permissions(administrator=True)
async def remove_allowed_cmd(ctx, command):
    """Remove a command from the restriction list for current channel"""
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels and command in restricted_channels[channel_id]:
        restricted_channels[channel_id].remove(command)
        if not restricted_channels[channel_id]:  # If list is empty, remove channel
            del restricted_channels[channel_id]
        save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
        await ctx.send(f"Removed '{command}' from allowed commands.")
    else:
        await ctx.send(f"'{command}' is not in the allowed list.")

@bot.command()
@commands.has_permissions(administrator=True)
async def clear_allowed_list(ctx):
    """Remove all allowed commands from current channel (same as unrestrict)"""
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels:
        del restricted_channels[channel_id]
        save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
        await ctx.send("All allowed commands cleared. Channel is now unrestricted.")
    else:
        await ctx.send("This channel has no restrictions to clear.")

@bot.command()
@commands.has_permissions(administrator=True)
async def whitelist_user(ctx, user_id):
    """Add user to whitelist - their messages will never be deleted"""
    whitelist_users[user_id] = True
    save_data(WHITELIST_FILE, whitelist_users)
    await ctx.send(f"User {user_id} added to whitelist.")

@bot.command()
@commands.has_permissions(administrator=True)
async def remove_whitelist(ctx, user_id):
    """Remove user from whitelist"""
    if user_id in whitelist_users:
        del whitelist_users[user_id]
        save_data(WHITELIST_FILE, whitelist_users)
        await ctx.send(f"User {user_id} removed from whitelist.")
    else:
        await ctx.send(f"User {user_id} is not in whitelist.")

@bot.command()
@commands.has_permissions(administrator=True)
async def list_whitelist(ctx):
    """List all whitelisted users"""
    if whitelist_users:
        users = ', '.join(whitelist_users.keys())
        await ctx.send(f"Whitelisted users: {users}")
    else:
        await ctx.send("No users in whitelist.")

@bot.command()
@commands.has_permissions(administrator=True)
async def get_user_id(ctx, *, user: discord.Member):
    """Get user ID by mentioning them"""
    await ctx.send(f"User ID for {user.name}: {user.id}")

@bot.command()
@commands.has_permissions(administrator=True)
async def add_command(ctx, command_name, *, response):
    """Add a custom command"""
    custom_commands[command_name] = response
    save_data(CUSTOM_COMMANDS_FILE, custom_commands)
    await ctx.send(f"Custom command '{command_name}' added.")

@bot.command()
@commands.has_permissions(administrator=True)
async def remove_command(ctx, command_name):
    """Remove a custom command"""
    if command_name in custom_commands:
        del custom_commands[command_name]
        save_data(CUSTOM_COMMANDS_FILE, custom_commands)
        await ctx.send(f"Custom command '{command_name}' removed.")
    else:
        await ctx.send(f"Command '{command_name}' not found.")

@bot.command()
@commands.has_permissions(administrator=True)
async def list_commands(ctx):
    """List all custom commands"""
    if custom_commands:
        cmd_list = ', '.join(custom_commands.keys())
        await ctx.send(f"Available custom commands: {cmd_list}")
    else:
        await ctx.send("No custom commands available.")

# Removed shop command handler - now !shop is treated as regular text

# Removed buy command handler - now !buy is treated as regular text

@bot.event
async def on_message(message):
    # Ignore bot messages
    if message.author == bot.user:
        return
    
    # Check for custom commands first
    for cmd_name, response in custom_commands.items():
        if message.content.startswith(cmd_name):
            await message.channel.send(response)
            return
    
    # Process bot commands and check if it was a valid command
    ctx = await bot.get_context(message)
    if ctx.valid:
        await bot.invoke(ctx)
        return  # Don't check restrictions for valid bot commands
    
    # Check restrictions for non-bot-command messages
    channel_id = str(message.channel.id)
    user_id = str(message.author.id)
    
    # Skip restrictions if user is whitelisted
    if user_id in whitelist_users:
        return
    
    # Only delete if channel is restricted
    if channel_id in restricted_channels:
        allowed_cmds = restricted_channels[channel_id]
        is_allowed = False
        
        for cmd in allowed_cmds:
            if message.content.startswith(cmd):
                is_allowed = True
                break
        
        if not is_allowed:
            try:
                await message.delete()
                # Show allowed commands list
                allowed_list = ', '.join(allowed_cmds)
                warning_msg = await message.channel.send(f"⚠️ Only these are allowed: {allowed_list}")
                # Delete the warning message after 5 seconds
                await asyncio.sleep(5)
                try:
                    await warning_msg.delete()
                except:
                    pass
            except:
                pass

# Run bot
if __name__ == "__main__":
    keep_alive()  # Start web server to keep Replit awake
    import os
    token = os.getenv('BOT_TOKEN')
    if not token:
        print("Error: BOT_TOKEN environment variable not set!")
        exit(1)
    bot.run(token)