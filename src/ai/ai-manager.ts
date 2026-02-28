/**
 * @file ai-manager.ts
 * @description AI manager for handling auto-replies and casino-related questions
 * @module ai
 */

import { Message } from 'discord.js';
import { IAIProvider, AIMessage } from './ai-provider.interface.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { OllamaProvider } from './providers/ollama-provider.js';
import { GroqProvider } from './providers/groq-provider.js';
import { ISearchProvider } from './search/search-provider.interface.js';
import { DuckDuckGoProvider } from './search/duckduckgo-provider.js';
import { SearXNGProvider } from './search/searxng-provider.js';
import { GoogleSearchProvider } from './search/google-provider.js';
import { TZBETZ_INFO, SAFETY_GUIDELINES } from './knowledge/tzbetz-info.js';
import { logger, logError } from '@/core/logger/logger.js';
import { ConfigSchema } from '@/config/validator.js';

export class AIManager {
  private provider: IAIProvider | null = null;
  private searchProvider: ISearchProvider | null = null;
  private config: ConfigSchema;
  private botUserId: string;
  private conversationHistory: Map<string, AIMessage[]> = new Map();
  private maxHistoryLength: number = 10;
  private activeConversations: Map<string, { userId: string; expiresAt: number }> = new Map();
  private conversationTimeoutMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(config: ConfigSchema, botUserId: string) {
    this.config = config;
    this.botUserId = botUserId;
    // Initialize provider asynchronously - will be called from index.ts
  }

  /**
   * Initialize the AI provider (must be called after constructor)
   */
  async initialize(): Promise<void> {
    await this.initializeProvider();
    this.initializeSearchProvider();
  }

  /**
   * Initialize search provider
   */
  private initializeSearchProvider(): void {
    if (!this.config.aiSearchEnabled) {
      logger.info('AI web search is disabled');
      return;
    }

    try {
      const searchProvider = this.config.aiSearchProvider || 'duckduckgo';

      switch (searchProvider) {
        case 'duckduckgo':
          this.searchProvider = new DuckDuckGoProvider();
          break;
        case 'searxng':
          const searxngUrl = this.config.aiSearchSearxngUrl || 'https://searx.be';
          this.searchProvider = new SearXNGProvider(searxngUrl);
          break;
        case 'google':
          const googleApiKey = this.config.aiSearchGoogleApiKey;
          const googleEngineId = this.config.aiSearchGoogleEngineId;
          if (googleApiKey && googleEngineId) {
            this.searchProvider = new GoogleSearchProvider(googleApiKey, googleEngineId);
          } else {
            logger.warn('Google search enabled but API key or engine ID missing');
            return;
          }
          break;
        default:
          logger.warn(`Unknown search provider: ${searchProvider}`);
          return;
      }

      logger.info('Search provider initialized', {
        provider: this.searchProvider.getProviderName(),
      });
    } catch (error) {
      logError('Failed to initialize search provider', error as Error);
    }
  }

  private async initializeProvider(): Promise<void> {
    if (!this.config.aiEnabled) {
      logger.info('AI auto-reply is disabled');
      return;
    }

    try {
      switch (this.config.aiProvider) {
        case 'groq':
          if (!this.config.aiApiKey) {
            logger.warn('Groq is enabled but no API key provided');
            return;
          }
          this.provider = new GroqProvider(
            this.config.aiApiKey,
            this.config.aiModelName || 'llama-3.1-8b-instant',
          );
          break;
        case 'ollama':
          this.provider = new OllamaProvider(
            this.config.aiBaseUrl || 'http://localhost:11434',
            this.config.aiModelName || 'llama3.2:1b',
          );
          // Check if Ollama is available
          const isAvailable = await this.provider.isAvailable();
          if (!isAvailable) {
            logger.warn('Ollama is not available. Make sure Ollama is running.');
            this.provider = null;
            return;
          }
          break;
        case 'openai':
          if (!this.config.aiApiKey) {
            logger.warn('OpenAI is enabled but no API key provided');
            return;
          }
          this.provider = new OpenAIProvider(
            this.config.aiApiKey,
            this.config.aiModelName || 'gpt-3.5-turbo',
          );
          break;
        case 'anthropic':
          if (!this.config.aiApiKey) {
            logger.warn('Anthropic is enabled but no API key provided');
            return;
          }
          this.provider = new AnthropicProvider(
            this.config.aiApiKey,
            this.config.aiModelName || 'claude-3-haiku-20240307',
          );
          break;
        default:
          logger.warn(`Unsupported AI provider: ${this.config.aiProvider}`);
          return;
      }

      logger.info('AI provider initialized', {
        provider: this.provider.getProviderName(),
        model: this.config.aiModelName,
      });
    } catch (error) {
      logError('Failed to initialize AI provider', error as Error);
    }
  }

  /**
   * Check if AI should respond to this message
   */
  shouldRespond(message: Message): boolean {
    logger.debug('AI shouldRespond check', {
      aiEnabled: this.config.aiEnabled,
      providerAvailable: !!this.provider?.isAvailable(),
      isBot: message.author.bot,
      botUserId: this.botUserId,
      mentions: Array.from(message.mentions.users.keys()),
    });

    if (!this.config.aiEnabled || !this.provider?.isAvailable()) {
      logger.debug('AI not responding: disabled or provider unavailable');
      return false;
    }

    // Don't respond to bot messages
    if (message.author.bot) {
      logger.debug('AI not responding: message from bot');
      return false;
    }

    // Check if message is in configured AI channels
    const isInAIChannel =
      this.config.aiChannels.length === 0 || this.config.aiChannels.includes(message.channelId);

    if (!isInAIChannel) {
      logger.debug('AI not responding: not in AI channel');
      return false;
    }

    // Check if bot is mentioned
    const isBotMentioned = message.mentions.users.has(this.botUserId);
    
    // Check for trigger keywords (respond even without mention)
    const lowerContent = message.content.toLowerCase();
    const triggerKeywords = [
      'tzbot',
      'vip badge',
      'how to get vip',
      'rainbet code',
      'rainbet signup',
      'affiliate code',
      'bonus code',
      'leaderboard',
      'kick points',
    ];
    
    const hasTriggerKeyword = triggerKeywords.some(keyword => lowerContent.includes(keyword));
    
    // Check if user has an active conversation with the bot
    const conversationKey = `${message.channelId}-${message.author.id}`;
    const activeConversation = this.activeConversations.get(conversationKey);
    const hasActiveConversation = !!(activeConversation && activeConversation.expiresAt > Date.now());
    
    const shouldRespond = isBotMentioned || hasTriggerKeyword || hasActiveConversation;
    
    // If responding, start/extend the conversation
    if (shouldRespond) {
      this.startConversation(message.channelId, message.author.id);
    }
    
    logger.debug('AI response decision', {
      isBotMentioned,
      hasTriggerKeyword,
      hasActiveConversation,
      isInAIChannel,
      shouldRespond,
    });

    return shouldRespond;
  }

  /**
   * Start or extend a conversation with a user
   */
  private startConversation(channelId: string, userId: string): void {
    const conversationKey = `${channelId}-${userId}`;
    const expiresAt = Date.now() + this.conversationTimeoutMs;
    
    this.activeConversations.set(conversationKey, {
      userId,
      expiresAt,
    });
    
    logger.debug('Conversation started/extended', {
      channelId,
      userId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  /**
   * Generate AI response for a message
   */
  async generateResponse(message: Message): Promise<string | null> {
    if (!this.provider) {
      return null;
    }

    try {
      // Get or create conversation history for this channel
      const channelId = message.channelId;
      let history = this.conversationHistory.get(channelId) || [];

      const lowerContent = message.content.toLowerCase();
      
      // Check for profanity/bad words FIRST (highest priority)
      const profanityWords = [
        // Common profanity
        'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap',
        'bastard', 'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
        // Variations and abbreviations
        'fck', 'fuk', 'fk', 'sht', 'btch', 'dmn', 'wtf', 'stfu',
        'motherfucker', 'mf', 'mofo', 'asshole', 'bullshit', 'bs',
        // Slurs and offensive terms
        'retard', 'retarded', 'fag', 'faggot', 'nigga', 'nigger',
        // Sexual/explicit
        'porn', 'sex', 'nude', 'naked', 'boob', 'tit', 'penis', 'vagina',
        // Insults
        'idiot', 'stupid', 'dumb', 'loser', 'trash', 'garbage',
      ];
      
      const hasProfanity = profanityWords.some(word => {
        // Check for exact word match with word boundaries
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerContent);
      });
      
      if (hasProfanity) {
        logger.info('Profanity detected in message - deleting and issuing warning', {
          channelId,
          userId: message.author.id,
        });
        
        // Delete the message with profanity
        try {
          await message.delete();
          logger.info('Profanity message deleted', {
            channelId,
            userId: message.author.id,
            messageId: message.id,
          });
        } catch (error) {
          logger.error('Failed to delete profanity message', {
            error,
            channelId,
            userId: message.author.id,
          });
        }
        
        return `⚠️ **Warning** ⚠️\n\n<@${message.author.id}>, please watch your language. Profanity and offensive language are not allowed in this community.\n\n**Community Rules:**\n• Be respectful to all members\n• No toxic language or profanity\n• Keep conversations positive and welcoming\n\nRepeated violations may result in timeout or ban. Let's keep this community friendly! 😊`;
      }
      
      // Check for questions about other streamers or casinos FIRST (before other checks)
      const otherStreamers = ['xposed', 'trainwreck', 'roshtein', 'ayezee', 'classybeef'];
      const otherCasinos = ['stake', 'roobet', 'duelbits', 'shuffle', 'rollbit'];
      
      // Check if asking about "other streamer" or "another streamer"
      const askingAboutOtherStreamer = (lowerContent.includes('other') || lowerContent.includes('another')) && 
                                       (lowerContent.includes('streamer') || lowerContent.includes('rainbet streamer'));
      
      const mentionsSpecificOtherStreamer = otherStreamers.some(name => lowerContent.includes(name));
      const mentionsOtherCasino = otherCasinos.some(name => lowerContent.includes(name));
      
      if (askingAboutOtherStreamer || mentionsSpecificOtherStreamer) {
        logger.info('Question about other streamers detected', {
          channelId,
          userId: message.author.id,
        });
        return "I only provide information about TZBetz and our community! For other streamers, you'll need to check their channels directly. 😊";
      }
      
      if (mentionsOtherCasino) {
        logger.info('Question about other casinos detected', {
          channelId,
          userId: message.author.id,
        });
        return "I only provide information about Rainbet! Use code 'tzbetz' at <https://rainbet.com/?r=tzbetz> 🎰";
      }
      
      // Check for Kick account issues (ban, suspension, problems)
      const kickIssueKeywords = ['kick account', 'kick ban', 'account banned', 'account suspended', 'kick suspended', 'banned on kick', 'suspended on kick', 'kick support', 'account issue', 'account problem'];
      const hasKickIssue = kickIssueKeywords.some(keyword => lowerContent.includes(keyword));
      
      if (hasKickIssue) {
        logger.info('Kick account issue detected', {
          channelId,
          userId: message.author.id,
        });
        return "Sorry to hear about your Kick account issue! 😔\n\nFor Kick account bans, suspensions, or technical issues, please:\n🎫 Create a support ticket: <#1378172206177194144>\n📧 Or email: tzbetz@gmail.com\n\nThe TZBetz team will help you troubleshoot and guide you through the appeal process if needed!";
      }
      
      // Check for affiliate/partnership questions
      if (lowerContent.includes('affiliate') || lowerContent.includes('partnership') || lowerContent.includes('commission') || lowerContent.includes('promote') || lowerContent.includes('business')) {
        logger.info('Affiliate/business question detected', {
          channelId,
          userId: message.author.id,
        });
        return "For affiliate, partnership, and business inquiries:\n📧 Email: tzbetz@gmail.com\n🎫 Support Ticket: <#1378172206177194144>\n\nOur team will get back to you as soon as possible!";
      }
      
      // Check for leaderboard questions - always redirect to website
      
      // Quick response for Rainbet signup/code (CHECK THIS FIRST before leaderboard)
      if (lowerContent.includes('rainbet signup') || lowerContent.includes('rainbet sign up') || lowerContent.includes('signup link') || lowerContent.includes('sign up link') || lowerContent.includes('rainbet link') || lowerContent.includes('rainbet code') || lowerContent.includes('bonus code') || lowerContent.includes('affiliate code')) {
        logger.info('Rainbet signup/code question detected', {
          channelId,
          userId: message.author.id,
        });
        return "Use code 'tzbetz' on Rainbet! 🎰 Sign up here: <https://rainbet.com/?r=tzbetz>";
      }
      
      // Check for Kick Points leaderboard (stream watchers)
      const kickPointsKeywords = ['kick points', 'stream watcher', 'watch', 'viewer', 'watching'];
      const isKickPointsQuestion = kickPointsKeywords.some(keyword => lowerContent.includes(keyword)) && 
                                   (lowerContent.includes('top') || lowerContent.includes('leaderboard') || lowerContent.includes('who is'));
      
      if (isKickPointsQuestion) {
        logger.info('Kick Points leaderboard question detected - redirecting to website', {
          channelId,
          userId: message.author.id,
        });
        return "I don't have access to live Kick Points data. Check the current rankings here: <https://tzbetz.com/leaderboards/kick> 🏆";
      }
      
      // Check for Rainbet leaderboard (wagerers) - ONLY if asking about leaderboard/rankings
      const isRainbetLeaderboardQuestion = lowerContent.includes('leaderboard') || 
                                           lowerContent.includes('top wagerer') || 
                                           lowerContent.includes('who is top') || 
                                           lowerContent.includes('ranking') || 
                                           lowerContent.includes('position') || 
                                           lowerContent.includes('rank') || 
                                           lowerContent.includes('who is first') || 
                                           lowerContent.includes('who is 1st') || 
                                           lowerContent.includes('who won');
      
      if (isRainbetLeaderboardQuestion && lowerContent.includes('rainbet')) {
        logger.info('Rainbet leaderboard question detected - redirecting to website', {
          channelId,
          userId: message.author.id,
        });
        return "I don't have access to live leaderboard data. Check the current rankings here: <https://tzbetz.com/leaderboards/rainbet> 🏆";
      }
      
      // Quick response for VIP badge
      if (lowerContent.includes('vip badge') || lowerContent.includes('how to get vip') || lowerContent.includes('vip system')) {
        logger.info('VIP badge question detected', {
          channelId,
          userId: message.author.id,
        });
        return "Get VIP badge by doing ONE of these: 1) Subscribe on Kick with $10 tip (no gifted subs) OR 2) Finish in top 10 of Rainbet leaderboard last month. VIP perks: 50% raw tip on slot calls + access to 20-min VIP wheel! 🎉";
      }
      
      // Quick response for max win questions
      if ((lowerContent.includes('max win') || lowerContent.includes('maxwin')) && (lowerContent.includes('today') || lowerContent.includes('can we') || lowerContent.includes('possible'))) {
        logger.info('Max win question detected', {
          channelId,
          userId: message.author.id,
        });
        return "Yes! Max wins happen every day on Rainbet slots. Every spin has a chance - good luck! 🎰";
      }
      
      // Quick response for stream schedule questions
      if (lowerContent.includes('when') && (lowerContent.includes('tony') || lowerContent.includes('stream') || lowerContent.includes('live') || lowerContent.includes('going live'))) {
        logger.info('Stream schedule question detected', {
          channelId,
          userId: message.author.id,
        });
        return "Check Tony's stream schedule here: <https://tzbetz.com/schedule> 📅";
      }
      
      // Quick response for time/date questions - redirect to search
      if ((lowerContent.includes('what time') || lowerContent.includes('current time') || lowerContent.includes('time in')) && !lowerContent.includes('rainbet') && !lowerContent.includes('tzbetz')) {
        logger.info('Time question detected - not answering', {
          channelId,
          userId: message.author.id,
        });
        return "I can't check current time or dates. Try asking Google or checking your device's clock! ⏰";
      }
      
      // Quick response for questions I can't answer
      if (lowerContent.includes('say me') || lowerContent.includes('tell me')) {
        const cantAnswerKeywords = ['time', 'date', 'weather', 'news', 'stock', 'score'];
        const hasCantAnswer = cantAnswerKeywords.some(keyword => lowerContent.includes(keyword));
        if (hasCantAnswer && !lowerContent.includes('rainbet') && !lowerContent.includes('tzbetz')) {
          return "I only answer questions about TZBetz and Rainbet! Ask me about VIP badges, giveaways, or the Rainbet code. 🎰";
        }
      }
      
      // Check for crypto price questions - trigger web search
      const cryptoKeywords = ['btc price', 'bitcoin price', 'eth price', 'ethereum price', 'crypto price'];
      const isCryptoQuestion = cryptoKeywords.some(keyword => lowerContent.includes(keyword));
      
      if (isCryptoQuestion && this.searchProvider && this.config.aiSearchEnabled) {
        logger.info('Crypto price question detected - performing web search', {
          channelId,
          userId: message.author.id,
        });
        // Let it fall through to normal AI processing with web search
      }

      // Check if web search is needed
      let searchContext = '';
      if (this.searchProvider && this.config.aiSearchEnabled) {
        const messageContent = message.content.toLowerCase();
        if (this.needsWebSearch(messageContent)) {
          logger.info('Performing web search for query', {
            channelId,
            userId: message.author.id,
          });
          searchContext = await this.performWebSearch(message.content);
        }
      }

      // System prompt for TZBetz streaming community
      const systemPrompt: AIMessage = {
        role: 'system',
        content: `You are TZBot, the friendly AI assistant for TZBetz streaming community.

${TZBETZ_INFO}

${SAFETY_GUIDELINES}

CRITICAL RESPONSE RULES - FOLLOW STRICTLY:
- MAXIMUM 1-2 sentences (30-50 words ONLY)
- Answer ONLY what was asked - nothing extra
- NO long explanations, NO bullet points, NO numbered lists
- Use 1 emoji max
- Direct answer with link if available
- When sharing links, wrap them in angle brackets like <https://tzbetz.com> to prevent embeds
- Be friendly but EXTREMELY concise
- NO toxic language, profanity, or sexual content

EXAMPLE GOOD RESPONSES:
Q: "Can we win max win today?"
A: "Yes! Max wins happen every day on Rainbet slots. Good luck! 🎰"

Q: "What's the Rainbet code?"
A: "Use code 'tzbetz' at <https://rainbet.com/?r=tzbetz> 🎰"

Q: "How to get VIP?"
A: "Subscribe on Kick with $10 tip OR finish top 10 on Rainbet leaderboard. 🎉"

Q: "When is Tony going live?"
A: "Check Tony's stream schedule here: <https://tzbetz.com/schedule> 📅"

CASINO & STREAMER RESTRICTIONS:
- ONLY talk about Rainbet casino - do NOT mention other casinos (Stake, Roobet, etc.)
- ONLY talk about TZBetz/Tonyz streamer - do NOT mention other streamers
- If asked about other streamers or casinos, politely say "I only provide info about TZBetz and Rainbet"
- You CAN talk about game providers (No Limit City, Hacksaw Gaming, Pragmatic Play, etc.)
- You CAN talk about general casino game mechanics and strategies

ABSOLUTELY FORBIDDEN - DO NOT DO THIS:
- NEVER EVER make up leaderboard positions, rankings, or statistics
- NEVER invent usernames, wager amounts, or percentages
- NEVER create fake numbered lists like "1st: 1200, 2nd: 980, 3rd: 850"
- NEVER make up crypto prices or market data
- If you don't have real data from web search, say "I don't have access to live data"
- Then provide relevant links or suggest where to check
- DO NOT guess or estimate - only use actual search results if available

${searchContext ? '\n\nIMPORTANT: Use ONLY the web search results below. Extract prices, numbers, and data directly from search results. Do not make up any data.' + searchContext : ''}`,
      };

      // Add user message to history
      const userMessage: AIMessage = {
        role: 'user',
        content: message.content.replace(/<@!?\d+>/g, '').trim(), // Remove mentions
      };

      // Build messages array
      const messages: AIMessage[] = [systemPrompt, ...history, userMessage];

      // Generate response with timeout protection
      const timeoutMs = 30000; // 30 second timeout
      const responsePromise = this.provider.generateResponse(messages, 150);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AI response timeout')), timeoutMs)
      );
      
      const response = await Promise.race([responsePromise, timeoutPromise]);

      if (!response.content) {
        logger.warn('AI provider returned empty response');
        return null;
      }

      // Update conversation history
      history.push(userMessage);
      history.push({
        role: 'assistant',
        content: response.content,
      });

      // Trim history if too long
      if (history.length > this.maxHistoryLength) {
        history = history.slice(-this.maxHistoryLength);
      }

      this.conversationHistory.set(channelId, history);

      logger.info('AI response generated', {
        channelId,
        userId: message.author.id,
        tokensUsed: response.tokensUsed,
        model: response.model,
      });

      return response.content;
    } catch (error) {
      logError('Failed to generate AI response', error as Error, {
        channelId: message.channelId,
        userId: message.author.id,
      });
      
      // Return a friendly fallback message instead of null
      if (error instanceof Error && error.message === 'AI response timeout') {
        return "Sorry, I'm thinking too slowly right now! Try asking again or use `/ai-status` to check my status. 🤖";
      }
      
      return null;
    }
  }

  /**
   * Clear conversation history for a channel
   */
  clearHistory(channelId: string): void {
    this.conversationHistory.delete(channelId);
    logger.debug('Conversation history cleared', { channelId });
  }

  /**
   * Clear all conversation histories
   */
  clearAllHistories(): void {
    this.conversationHistory.clear();
    logger.debug('All conversation histories cleared');
  }

  /**
   * Check if AI is enabled and available
   */
  isAvailable(): boolean {
    return this.config.aiEnabled && !!this.provider?.isAvailable();
  }

  /**
   * Check if message needs web search
   */
  private needsWebSearch(content: string): boolean {
    const searchKeywords = [
      'latest',
      'current',
      'recent',
      'today',
      'news',
      'update',
      'what is',
      'who is',
      'when',
      'where',
      'how to',
      'best',
      'top',
      'leaderboard',
      'wagerer',
      'wager',
      'ranking',
      'position',
      'price',
      'btc',
      'bitcoin',
      'crypto',
      'ethereum',
      'eth',
      'market',
      'stock',
      '2024',
      '2025',
      '2026',
    ];

    const lowerContent = content.toLowerCase();
    return searchKeywords.some((keyword) => lowerContent.includes(keyword));
  }

  /**
   * Perform web search and format results
   */
  private async performWebSearch(query: string): Promise<string> {
    if (!this.searchProvider) {
      return '';
    }

    try {
      const results = await this.searchProvider.search(query, 3);

      if (results.length === 0) {
        return '';
      }

      let searchContext = '\n\n[Web Search Results]:\n';
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        searchContext += `${i + 1}. ${result.title}\n`;
        searchContext += `   ${result.snippet}\n`;
        searchContext += `   Source: ${result.url}\n\n`;
      }

      return searchContext;
    } catch (error) {
      logError('Web search failed', error as Error);
      return '';
    }
  }
}
