/**
 * @file violation-tracker.ts
 * @description Violation tracking system with escalation matrix
 * @module moderation
 */

import type { ViolationRepository } from '@/core/database/repositories/ViolationRepository.js';
import type { ViolationType, PunishmentLevel } from '@/types/models.js';
import { PunishmentLevel as PunishmentLevelEnum } from '@/types/models.js';

/**
 * Time windows for violation tracking
 */
const TIME_WINDOWS = {
  HOURS_24: 24 * 60 * 60 * 1000,
  DAYS_7: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Severity scores for punishment levels
 */
const SEVERITY_SCORES: Record<PunishmentLevel, number> = {
  [PunishmentLevelEnum.WARNING]: 1,
  [PunishmentLevelEnum.TIMEOUT_1H]: 2,
  [PunishmentLevelEnum.TIMEOUT_2H]: 3,
  [PunishmentLevelEnum.TIMEOUT_4H]: 4,
  [PunishmentLevelEnum.TIMEOUT_8H]: 5,
  [PunishmentLevelEnum.TIMEOUT_16H]: 6,
  [PunishmentLevelEnum.TIMEOUT_24H]: 7,
  [PunishmentLevelEnum.BAN]: 8,
};

/**
 * ViolationTracker class
 * Implements progressive punishment escalation based on violation history
 */
export class ViolationTracker {
  constructor(private violationRepository: ViolationRepository) {}

  /**
   * Record a violation and determine appropriate punishment
   * Escalation matrix:
   * - 1st violation in 24h: WARNING
   * - 2nd violation in 24h: TIMEOUT_1H
   * - 3rd violation in 24h: TIMEOUT_24H
   * - 4th violation in 7d: BAN
   */
  async recordViolation(
    userId: string,
    type: ViolationType,
    details: string,
  ): Promise<{ violationId: string; punishment: PunishmentLevel }> {
    const now = new Date();
    
    // Get violation counts for escalation calculation
    const violations24h = await this.violationRepository.getCount(
      userId,
      new Date(now.getTime() - TIME_WINDOWS.HOURS_24)
    );
    
    const violations7d = await this.violationRepository.getCount(
      userId,
      new Date(now.getTime() - TIME_WINDOWS.DAYS_7)
    );

    // Determine punishment level based on escalation matrix
    let punishment: PunishmentLevel;
    
    // Check 7-day ban threshold first (4th violation in 7 days)
    if (violations7d >= 3) {
      punishment = PunishmentLevelEnum.BAN;
    }
    // Then check 24-hour escalation
    else if (violations24h >= 2) {
      punishment = PunishmentLevelEnum.TIMEOUT_24H;
    } else if (violations24h >= 1) {
      punishment = PunishmentLevelEnum.TIMEOUT_1H;
    } else {
      punishment = PunishmentLevelEnum.WARNING;
    }

    // Save the violation
    const violationId = await this.violationRepository.save({
      userId,
      type,
      severity: SEVERITY_SCORES[punishment],
      timestamp: now,
      details,
      punishmentApplied: punishment,
    });

    return { violationId, punishment };
  }

  /**
   * Get total violation count for a user
   */
  async getViolationCount(userId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - TIME_WINDOWS.DAYS_7);
    return this.violationRepository.getCount(userId, sevenDaysAgo);
  }

  /**
   * Clear all violations for a user
   */
  async clearViolations(userId: string): Promise<void> {
    await this.violationRepository.clear(userId);
  }
}
