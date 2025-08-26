import asyncio
import signal
import sys
from bot import bot

async def run_with_timeout():
    try:
        # Start the bot
        token = os.getenv('BOT_TOKEN')
        if not token:
            print("Error: BOT_TOKEN environment variable not set!")
            return
        await bot.start(token)
    except Exception as e:
        print(f"Bot error: {e}")

def timeout_handler():
    print("Bot started successfully! Running for 5 seconds...")
    asyncio.get_event_loop().stop()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Set timeout
    loop.call_later(5, timeout_handler)
    
    try:
        loop.run_until_complete(run_with_timeout())
    except KeyboardInterrupt:
        print("Bot stopped.")
    finally:
        loop.close()