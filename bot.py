import discord
from discord.ext import commands
import json
import os

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# Data files
RESTRICTED_CHANNELS_FILE = 'restricted_channels.json'
CUSTOM_COMMANDS_FILE = 'custom_commands.json'
ALLOWED_COMMANDS_FILE = 'allowed_commands.json'

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
allowed_commands = load_data(ALLOWED_COMMANDS_FILE)

@bot.event
async def on_ready():
    print(f'{bot.user} is online!')



@bot.command()
@commands.has_permissions(administrator=True)
async def restrict_channel(ctx, *commands):
    """Restrict current channel to only allow specified commands"""
    if not commands:
        await ctx.send("Please provide commands to allow. Example: `!restrict_channel !shop !buy`")
        return
    
    channel_id = str(ctx.channel.id)
    restricted_channels[channel_id] = list(commands)
    save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
    
    await ctx.send(f"Channel restricted. Only these commands are allowed: {', '.join(commands)}")

@bot.command()
@commands.has_permissions(administrator=True)
async def shop_channel(ctx):
    """Restrict current channel to only allow shop commands (!buy, !shop)"""
    channel_id = str(ctx.channel.id)
    restricted_channels[channel_id] = ['!buy', '!shop']
    save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
    
    await ctx.send("Channel restricted to shop commands only (!buy [item], !shop [number]). All other messages will be deleted.")

def is_valid_shop_command(message_content):
    """Validate shop commands"""
    parts = message_content.split()
    
    if parts[0] == '!shop':
        # Allow !shop or !shop [number]
        if len(parts) == 1:
            return True
        if len(parts) == 2 and parts[1].isdigit():
            return True
        return False
    
    if parts[0] == '!buy':
        # Allow !buy [item name]
        if len(parts) >= 2:
            return True
        return False
    
    return False

@bot.command()
@commands.has_permissions(administrator=True)
async def unrestrict_channel(ctx):
    """Remove restrictions from current channel"""
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels:
        del restricted_channels[channel_id]
        save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
        await ctx.send(f"Channel restrictions removed for channel {channel_id}.")
    else:
        await ctx.send(f"This channel ({channel_id}) is not restricted.")

@bot.command()
@commands.has_permissions(administrator=True)
async def clear_all_restrictions(ctx):
    """Remove all channel restrictions"""
    restricted_channels.clear()
    save_data(RESTRICTED_CHANNELS_FILE, restricted_channels)
    await ctx.send("All channel restrictions cleared.")

@bot.command()
async def check_restrictions(ctx):
    """Check if current channel is restricted"""
    # Reload data to ensure fresh check
    global restricted_channels
    restricted_channels = load_data(RESTRICTED_CHANNELS_FILE)
    
    channel_id = str(ctx.channel.id)
    if channel_id in restricted_channels:
        allowed = ', '.join(restricted_channels[channel_id])
        await ctx.send(f"This channel is restricted. Allowed: {allowed}")
    else:
        await ctx.send("This channel is not restricted.")

@bot.command()
@commands.has_permissions(administrator=True)
async def reload_data(ctx):
    """Reload all data files"""
    global restricted_channels, custom_commands, allowed_commands
    restricted_channels = load_data(RESTRICTED_CHANNELS_FILE)
    custom_commands = load_data(CUSTOM_COMMANDS_FILE)
    allowed_commands = load_data(ALLOWED_COMMANDS_FILE)
    await ctx.send("All data reloaded from files.")

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
async def list_commands(ctx):
    """List all custom commands"""
    if custom_commands:
        cmd_list = ', '.join(custom_commands.keys())
        await ctx.send(f"Available custom commands: {cmd_list}")
    else:
        await ctx.send("No custom commands available.")

@bot.command()
async def splash(ctx):
    """Display bot splash message"""
    embed = discord.Embed(
        title="🤖 TZbot - Text Restriction Bot",
        description="Restricts text in channels and allows only preset commands.",
        color=0x00ff00
    )
    embed.add_field(name="Commands", value="`!restrict_channel`, `!add_allowed`, `!list_allowed`", inline=False)
    embed.add_field(name="Status", value="✅ Online and Ready!", inline=False)
    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(administrator=True)
async def add_allowed(ctx, command_name):
    """Add a command to allowed list"""
    if command_name not in allowed_commands:
        allowed_commands[command_name] = True
        save_data(ALLOWED_COMMANDS_FILE, allowed_commands)
        await ctx.send(f"Command '{command_name}' added to allowed list.")
    else:
        await ctx.send(f"Command '{command_name}' already allowed.")

@bot.command()
@commands.has_permissions(administrator=True)
async def remove_allowed(ctx, command_name):
    """Remove a command from allowed list"""
    if command_name in allowed_commands:
        del allowed_commands[command_name]
        save_data(ALLOWED_COMMANDS_FILE, allowed_commands)
        await ctx.send(f"Command '{command_name}' removed from allowed list.")
    else:
        await ctx.send(f"Command '{command_name}' not in allowed list.")

@bot.command()
async def list_allowed(ctx):
    """List all allowed commands"""
    if allowed_commands:
        cmd_list = ', '.join(allowed_commands.keys())
        await ctx.send(f"Allowed commands: {cmd_list}")
    else:
        await ctx.send("No allowed commands set.")

@bot.command()
async def shop(ctx, item_id=None):
    """Shop command"""
    if item_id:
        await ctx.send(f"Showing item {item_id} from shop.")
    else:
        await ctx.send("Welcome to the shop! Use `!shop [number]` to view items.")

@bot.command()
async def buy(ctx, *, item_name=None):
    """Buy command"""
    if item_name:
        await ctx.send(f"You bought: {item_name}")
    else:
        await ctx.send("Please specify what you want to buy. Use `!buy [item name]`")

@bot.event
async def on_message(message):
    if message.author == bot.user:
        return
    
    # Always process bot commands first
    if message.content.startswith('!'):
        await bot.process_commands(message)
        return
    
    # Check for custom commands
    for cmd_name, response in custom_commands.items():
        if message.content.startswith(cmd_name):
            await message.channel.send(response)
            return
    
    channel_id = str(message.channel.id)
    
    # Reload restrictions to ensure fresh data
    global restricted_channels
    restricted_channels = load_data(RESTRICTED_CHANNELS_FILE)
    
    # Only delete messages if channel is restricted AND message not allowed
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
            except:
                pass

# Run bot
if __name__ == "__main__":
    bot.run('MTQwODg5NzI2NzUxOTE5MzI4Mg.GWukYU.u7EOQvyxmE3yhjbpOHDeODREHqEFm9drKtU3t4')