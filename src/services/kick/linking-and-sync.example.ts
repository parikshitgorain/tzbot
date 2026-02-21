// @ts-nocheck
/**
 * @file linking-and-sync.example.ts
 * @description Example usage of user linking and role synchronization systems
 * @module services/kick
 */

import { UserLinkingSystem } from './user-linking.js';
import { RoleSyncSystem } from './role-sync.js';
import { kickChatClient } from './chat-client.js';
import { discordClient } from '../../core/discord/client.js';
import { Database } from '../../core/database/Database.js';
import { config } from '../../config/index.js';

/**
 * Example: Setting up user linking and role synchronization
 */
async function setupLinkingAndRoleSync() {
  // Initialize database
  const database = new Database(config.databaseUrl);
  await database.connect();

  // Create user linking system
  const linkingSystem = new UserLinkingSystem(database.users);

  // Create role sync system
  const roleSyncSystem = new RoleSyncSystem(
    {
      guildId: config.guildId,
      subscriberRoleId: config.subscriberRoleId,
      vipRoleId: config.vipRoleId,
      enabled: true,
    },
    discordClient,
    linkingSystem
  );

  // Connect to Kick chat
  await kickChatClient.connect({
    channelId: config.kickChannelId!,

    // Handle incoming messages
    onMessage: async (message) => {
      console.log(`[Kick Chat] ${message.username}: ${message.content}`);

      // Check for verification commands
      const linkResult = await linkingSystem.processVerificationMessage(message);
      if (linkResult) {
        if (linkResult.success) {
          console.log(
            `✅ Account linked: ${linkResult.kickUsername} -> ${linkResult.discordId}`
          );

          // Send confirmation DM to Discord user
          try {
            const member = await discordClient.getMember(
              config.guildId,
              linkResult.discordId!
            );
            if (member) {
              await member.send(
                `✅ Your account has been successfully linked to Kick username: ${linkResult.kickUsername}\n\n` +
                  `Your roles will now be automatically synchronized based on your Kick badges!`
              );
            }
          } catch (error) {
            console.error('Failed to send confirmation DM:', error);
          }

          // Immediately sync roles for the newly linked user
          const badgeInfo = kickChatClient.extractBadges(message);
          await roleSyncSystem.syncRolesFromBadges(badgeInfo);
        } else {
          console.log(`❌ Linking failed: ${linkResult.error}`);
        }
        return;
      }

      // Sync roles based on badges
      const syncResult = await roleSyncSystem.syncRolesFromMessage(message);
      if (syncResult) {
        if (syncResult.success) {
          if (syncResult.rolesAdded.length > 0) {
            console.log(
              `✅ Added roles for ${syncResult.kickUsername}: ${syncResult.rolesAdded.join(', ')}`
            );
          }
          if (syncResult.rolesRemoved.length > 0) {
            console.log(
              `✅ Removed roles for ${syncResult.kickUsername}: ${syncResult.rolesRemoved.join(', ')}`
            );
          }
        } else {
          console.error(`❌ Role sync failed: ${syncResult.error}`);
        }
      }
    },

    // Handle subscriber detection
    onSubscriberDetected: async (username, months) => {
      console.log(`🎉 Subscriber detected: ${username} (${months} months)`);
    },

    // Handle VIP detection
    onVIPDetected: async (username) => {
      console.log(`⭐ VIP detected: ${username}`);
    },

    // Handle connection state changes
    onConnectionChange: (state) => {
      console.log(`Kick chat connection state: ${state}`);
    },

    // Handle errors
    onError: (error) => {
      console.error('Kick chat error:', error);
    },
  });

  console.log('✅ User linking and role sync systems initialized');
}

/**
 * Example: Discord /link command handler
 */
async function handleLinkCommand(
  discordUserId: string,
  linkingSystem: UserLinkingSystem
) {
  // Check if already linked
  const isLinked = await linkingSystem.isLinked(discordUserId);
  if (isLinked) {
    const kickUsername = await linkingSystem.getKickUsername(discordUserId);
    return `You are already linked to Kick username: ${kickUsername}\n\nUse /unlink to remove the link.`;
  }

  // Generate linking token
  const linkToken = await linkingSystem.startLinking(discordUserId);

  // Send instructions to user
  return (
    `🔗 **Account Linking Instructions**\n\n` +
    `To link your Kick account, follow these steps:\n\n` +
    `1. Go to the Kick stream chat\n` +
    `2. Type the following command in chat:\n` +
    `   \`!verify ${linkToken.token}\`\n\n` +
    `Your token will expire in 10 minutes.\n\n` +
    `Once verified, your Discord roles will automatically sync with your Kick badges!`
  );
}

/**
 * Example: Discord /unlink command handler
 */
async function handleUnlinkCommand(
  discordUserId: string,
  linkingSystem: UserLinkingSystem,
  roleSyncSystem: RoleSyncSystem
) {
  // Check if linked
  const isLinked = await linkingSystem.isLinked(discordUserId);
  if (!isLinked) {
    return `You don't have a linked Kick account.`;
  }

  const kickUsername = await linkingSystem.getKickUsername(discordUserId);

  // Remove roles before unlinking
  await roleSyncSystem.syncUserRoles(discordUserId, false, false);

  // Unlink accounts
  await linkingSystem.unlinkAccounts(discordUserId);

  return `✅ Your account has been unlinked from Kick username: ${kickUsername}\n\nYour subscriber and VIP roles have been removed.`;
}

/**
 * Example: Discord /checklink command handler
 */
async function handleCheckLinkCommand(
  discordUserId: string,
  linkingSystem: UserLinkingSystem
) {
  const isLinked = await linkingSystem.isLinked(discordUserId);

  if (!isLinked) {
    return `You don't have a linked Kick account.\n\nUse /link to start the linking process.`;
  }

  const kickUsername = await linkingSystem.getKickUsername(discordUserId);
  return `✅ Your Discord account is linked to Kick username: **${kickUsername}**\n\nYour roles are automatically synchronized based on your Kick badges.`;
}

/**
 * Example: Manual role sync for a user
 */
async function manualRoleSync(
  discordUserId: string,
  roleSyncSystem: RoleSyncSystem
) {
  // This would typically be called by a moderator command
  // or as part of a periodic sync job

  // For this example, we'll assume the user has both badges
  const result = await roleSyncSystem.syncUserRoles(discordUserId, true, true);

  if (result.success) {
    console.log(`✅ Manual role sync completed for ${result.kickUsername}`);
    console.log(`  Roles added: ${result.rolesAdded.join(', ') || 'none'}`);
    console.log(`  Roles removed: ${result.rolesRemoved.join(', ') || 'none'}`);
  } else {
    console.error(`❌ Manual role sync failed: ${result.error}`);
  }
}

/**
 * Example: Periodic cleanup of expired tokens
 */
function startTokenCleanup(linkingSystem: UserLinkingSystem) {
  // Clean up expired tokens every 5 minutes
  setInterval(
    async () => {
      await linkingSystem.cleanupExpiredTokens();
    },
    5 * 60 * 1000
  );
}

/**
 * Example: Enable/disable role sync
 */
function toggleRoleSync(roleSyncSystem: RoleSyncSystem, enabled: boolean) {
  roleSyncSystem.setEnabled(enabled);
  console.log(`Role synchronization ${enabled ? 'enabled' : 'disabled'}`);
}

// Export example functions
export {
  setupLinkingAndRoleSync,
  handleLinkCommand,
  handleUnlinkCommand,
  handleCheckLinkCommand,
  manualRoleSync,
  startTokenCleanup,
  toggleRoleSync,
};
