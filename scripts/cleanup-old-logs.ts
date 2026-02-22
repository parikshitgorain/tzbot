#!/usr/bin/env tsx
/**
 * @file cleanup-old-logs.ts
 * @description Script to manually clean up log files older than 30 days
 * @usage tsx scripts/cleanup-old-logs.ts
 */

import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const MAX_AGE_DAYS = 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Clean up old log files
 */
async function cleanupOldLogs(): Promise<void> {
  console.log('🧹 Starting log cleanup...');
  console.log(`📁 Logs directory: ${LOGS_DIR}`);
  console.log(`⏰ Max age: ${MAX_AGE_DAYS} days\n`);

  if (!fs.existsSync(LOGS_DIR)) {
    console.log('❌ Logs directory does not exist');
    return;
  }

  const files = fs.readdirSync(LOGS_DIR);
  const now = Date.now();
  let deletedCount = 0;
  let totalSize = 0;

  for (const file of files) {
    // Skip .gitkeep and audit files
    if (file === '.gitkeep' || file.startsWith('.') || file.endsWith('-audit.json')) {
      continue;
    }

    const filePath = path.join(LOGS_DIR, file);
    const stats = fs.statSync(filePath);

    // Check if file is older than MAX_AGE_DAYS
    const fileAge = now - stats.mtimeMs;
    const fileAgeDays = Math.floor(fileAge / (24 * 60 * 60 * 1000));

    if (fileAge > MAX_AGE_MS) {
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`🗑️  Deleting: ${file} (${fileAgeDays} days old, ${fileSizeMB} MB)`);
      
      fs.unlinkSync(filePath);
      deletedCount++;
      totalSize += stats.size;
    } else {
      console.log(`✅ Keeping: ${file} (${fileAgeDays} days old)`);
    }
  }

  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  
  console.log(`\n✨ Cleanup complete!`);
  console.log(`📊 Deleted ${deletedCount} file(s)`);
  console.log(`💾 Freed ${totalSizeMB} MB of disk space`);
}

// Run cleanup
cleanupOldLogs().catch((error) => {
  console.error('❌ Error during cleanup:', error);
  process.exit(1);
});
