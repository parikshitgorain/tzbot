# AI Web Search Feature Guide

The bot's AI can now search the internet for current information, making responses more accurate and up-to-date.

## Overview

When enabled, the AI will automatically search the web when it detects queries that need current information, such as:
- "What are the latest casino bonuses?"
- "Best slot games in 2026"
- "Current jackpot winners"
- "How to play [new game]"
- "Top rated casinos today"

## Quick Setup

### Enable Web Search

Edit your `.env` file:

```env
# Enable AI web search
AI_SEARCH_ENABLED=true

# Choose provider (duckduckgo, searxng, or google)
AI_SEARCH_PROVIDER=duckduckgo
```

That's it! DuckDuckGo requires no API key and works immediately.

## Search Providers

### 1. DuckDuckGo (Recommended)

**Pros:**
- ✅ Free, no API key needed
- ✅ Privacy-focused
- ✅ No rate limits
- ✅ Works immediately

**Cons:**
- ❌ Limited to instant answers and related topics
- ❌ Fewer results than Google

**Configuration:**
```env
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=duckduckgo
```

### 2. SearXNG

**Pros:**
- ✅ Free, no API key needed
- ✅ Meta-search (searches multiple engines)
- ✅ Privacy-focused
- ✅ More results than DuckDuckGo

**Cons:**
- ❌ Requires public SearXNG instance
- ❌ Instance availability varies

**Configuration:**
```env
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=searxng
AI_SEARCH_SEARXNG_URL=https://searx.be
```

**Popular SearXNG Instances:**
- https://searx.be
- https://searx.work
- https://search.sapti.me
- https://searx.tiekoetter.com

### 3. Google Custom Search

**Pros:**
- ✅ Best search quality
- ✅ Most comprehensive results
- ✅ Official Google API

**Cons:**
- ❌ Requires API key
- ❌ Limited free tier (100 queries/day)
- ❌ Costs money after free tier

**Setup:**

1. **Create Custom Search Engine:**
   - Go to: https://programmablesearchengine.google.com/
   - Click "Add" to create new search engine
   - Set "Sites to search" to "Search the entire web"
   - Get your Search Engine ID

2. **Get API Key:**
   - Go to: https://console.cloud.google.com/
   - Enable "Custom Search API"
   - Create credentials (API key)

3. **Configure:**
```env
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=google
AI_SEARCH_GOOGLE_API_KEY=your_api_key_here
AI_SEARCH_GOOGLE_ENGINE_ID=your_engine_id_here
```

## How It Works

### Automatic Detection

The AI automatically detects when web search is needed based on keywords:

**Triggers web search:**
- "latest", "current", "recent", "today"
- "news", "update"
- "what is", "who is", "when", "where"
- "how to", "best", "top"
- Year mentions (2024, 2025, 2026)

**Examples:**
```
User: "What are the best slot games in 2026?"
Bot: [Searches web] → Provides current information with sources

User: "How do I play blackjack?"
Bot: [No search needed] → Uses existing knowledge

User: "Latest casino news"
Bot: [Searches web] → Provides recent news with sources
```

### Search Process

1. User sends message
2. AI detects if search is needed
3. Performs web search (3 results)
4. Includes results in AI context
5. AI generates response using search results
6. Cites sources in response

### Response Format

When using search results, the AI will:
- Provide accurate, current information
- Cite sources with URLs
- Mention where information came from

Example response:
```
Based on recent information, the top slot games in 2026 include:

1. Mega Fortune - Known for progressive jackpots
2. Starburst - Popular for its simplicity
3. Gonzo's Quest - Features unique avalanche mechanics

Sources:
- CasinoGuide.com
- SlotReviews.net
```

## Configuration Options

### Full Configuration

```env
# AI Settings
AI_ENABLED=true
AI_PROVIDER=ollama
AI_MODEL_NAME=llama3.2:1b

# Web Search Settings
AI_SEARCH_ENABLED=true
AI_SEARCH_PROVIDER=duckduckgo
AI_SEARCH_SEARXNG_URL=https://searx.be
AI_SEARCH_GOOGLE_API_KEY=
AI_SEARCH_GOOGLE_ENGINE_ID=
```

### Disable Web Search

```env
AI_SEARCH_ENABLED=false
```

Bot will still work but won't search the web.

## Testing

### Test Web Search

```
# In Discord, ask questions that trigger search:
@BotName what are the latest casino bonuses?
@BotName best slot games in 2026
@BotName current jackpot winners
```

### Check Logs

```bash
# Look for search activity
pm2 logs tzbot | grep "web search"

# Should see:
# "Performing web search for query"
# "DuckDuckGo search completed"
```

## Performance Impact

### DuckDuckGo
- **Latency:** +0.5-1 second per search
- **Reliability:** High
- **Cost:** Free

### SearXNG
- **Latency:** +1-2 seconds per search
- **Reliability:** Depends on instance
- **Cost:** Free

### Google
- **Latency:** +0.3-0.5 seconds per search
- **Reliability:** Very high
- **Cost:** Free (100/day), then $5/1000 queries

## Troubleshooting

### Search Not Working

```bash
# Check if enabled
grep AI_SEARCH_ENABLED .env

# Check logs
pm2 logs tzbot | grep -i search

# Test provider manually
curl "https://api.duckduckgo.com/?q=test&format=json"
```

### No Results

- Try different search provider
- Check internet connectivity
- Verify API keys (for Google)
- Check provider status

### Slow Responses

- Use DuckDuckGo (fastest)
- Reduce search frequency
- Check network latency
- Consider disabling search

## Privacy Considerations

### DuckDuckGo
- ✅ No tracking
- ✅ No personal data collected
- ✅ Privacy-focused

### SearXNG
- ✅ No tracking
- ✅ Proxies requests
- ✅ Privacy-focused

### Google
- ⚠️ Google tracks searches
- ⚠️ Logs API usage
- ⚠️ Less private

## Best Practices

1. **Start with DuckDuckGo** - Free and works immediately
2. **Monitor usage** - Check logs for search frequency
3. **Test responses** - Verify search results are helpful
4. **Consider costs** - Google has limits and costs
5. **Privacy first** - Use DuckDuckGo or SearXNG for privacy

## Advanced Configuration

### Custom Search Keywords

Edit `src/ai/ai-manager.ts` to customize when search triggers:

```typescript
private needsWebSearch(content: string): boolean {
  const searchKeywords = [
    'latest',
    'current',
    // Add your keywords here
    'trending',
    'popular',
  ];
  // ...
}
```

### Adjust Result Count

Edit `src/ai/ai-manager.ts`:

```typescript
const results = await this.searchProvider.search(query, 5); // Change from 3 to 5
```

### Custom SearXNG Instance

Host your own SearXNG:
```bash
docker run -d -p 8080:8080 searxng/searxng
```

Then configure:
```env
AI_SEARCH_SEARXNG_URL=http://localhost:8080
```

## Examples

### Casino Information
```
User: "What are the best online casinos in 2026?"
Bot: [Searches] Provides current top-rated casinos with sources
```

### Game Rules
```
User: "How to play Texas Hold'em?"
Bot: [No search] Uses existing knowledge
```

### Current Events
```
User: "Latest casino jackpot winners"
Bot: [Searches] Provides recent winner information
```

### Comparisons
```
User: "Best slot games vs table games"
Bot: [May search] Provides comparison with current data
```

## Monitoring

### Check Search Activity

```bash
# View search logs
pm2 logs tzbot | grep "web search"

# Count searches
pm2 logs tzbot | grep "web search" | wc -l

# View search queries
pm2 logs tzbot | grep "Performing web search"
```

### Monitor Performance

```bash
# Check response times
pm2 logs tzbot | grep "AI response generated"

# Monitor errors
pm2 logs tzbot | grep "search failed"
```

## FAQ

**Q: Does web search cost money?**
A: DuckDuckGo and SearXNG are free. Google has a free tier (100/day) then costs money.

**Q: How often does it search?**
A: Only when keywords trigger it (latest, current, best, etc.)

**Q: Can I disable it?**
A: Yes, set `AI_SEARCH_ENABLED=false`

**Q: Which provider is best?**
A: DuckDuckGo for most users (free, fast, private)

**Q: Does it work offline?**
A: No, requires internet connection

**Q: Can I use multiple providers?**
A: No, choose one provider at a time

## Support

- Check logs: `pm2 logs tzbot`
- Test provider: Try manual API calls
- Review configuration: Check `.env` file
- Disable if needed: Set `AI_SEARCH_ENABLED=false`

---

**Feature Status:** Production Ready ✅
**Recommended Provider:** DuckDuckGo
**Cost:** Free (with DuckDuckGo/SearXNG)
