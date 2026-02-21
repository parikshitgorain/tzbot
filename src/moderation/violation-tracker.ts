/**
 * @file violation-tracker.ts
 * @description Violation tracking and escalation system for TZBOT
 * @module moderation
 * 
 * Implements the progressive punishment system:
 * - 1st spam: Warning (ephemeral message + DM, expires in 30 days)
 * - 2nd spam within 5 minutes: 5-minute timeout
 * - 3rd timeout within 30 days: Ban from server
 * - 3 warnings within 30 days: Timeout
 * - 3 warnings + timeout within 30 days: Ban from server
 * 
 * Validates: Requirements 4.1-4.6
 */

import type { ViolationType } from '../types/models.js';
import { PunishmentLevel } from '../types/models.js';
import type { EscalationResult } from '../types/interfaces.js';
import type { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';

/**
 * Time windows for escalation calculations
 */
const ESCALATION_WINDOWS = {
  /** 5 minutes in milliseconds */
  FIVE_MINUTES: 5 * 60 * 1000,
  /** 30 days in milliseconds */
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * ViolationTracker class
 * Handles violation recording and escalation matrix logic
 */
export class ViolationTracker {
  constructor(private violationRepo: ViolationRepository) {}

  /**
   * Record a violation and determine the appropriate punishment level
   * Implements the progressive punishment system:
   * - 1st spam: Warning (expires in 30 days)
   * - 2nd spam within 5 minutes: 5-minute timeout
   * - 3rd timeout within 30 days: Ban
   * - 3 warnings within 30 days: Timeout
   * 
   * @param userId - Discord user ID
   * @param type - Type of violation
   * @param details - Additional details about the violation
   * @param timestamp - When the violation occurred (defaults to now)
   * @returns Escalation result with punishment level
   */
  async recordViolation(
    userId: string,
    type: ViolationType,
    details: string,
    timestamp: Date = new Date()
  ): Promise<EscalationResult> {
    // Get violation counts for different time windows
    const fiveMinutesAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.FIVE_MINUTES);
    const thirtyDaysAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.THIRTY_DAYS);

    const violationsIn5min = await this.violationRepo.getCount(userId, fiveMinutesAgo);
    const violationsIn30days = await this.violationRepo.getCount(userId, thirtyDaysAgo);
    
    // Count warnings and timeouts separately
    const warningsIn30days = await this.violationRepo.getCountByPunishment(
      userId, 
      thirtyDaysAgo, 
      PunishmentLevel.WARNING
    );
    const timeoutsIn30days = await this.violationRepo.getCountByPunishment(
      userId,
      thirtyDaysAgo,
      [PunishmentLevel.TIMEOUT_5M, PunishmentLevel.TIMEOUT_1H, PunishmentLevel.TIMEOUT_24H]
    );

    // Determine punishment level based on escalation matrix
    const escalation = this.calculateEscalation(
      violationsIn5min,
      violationsIn30days,
      warningsIn30days,
      timeoutsIn30days
    );

    // Save the violation with the determined punishment
    await this.violationRepo.save({
      userId,
      type,
      severity: this.getSeverityScore(escalation.punishmentLevel),
      timestamp,
      details,
      punishmentApplied: escalation.punishmentLevel,
    });

    return escalation;
  }

  /**
   * Calculate the appropriate punishment level based on violation counts
   * Implements the progressive punishment system:
   * - 1st spam: Warning (expires in 30 days)
   * - 2nd spam within 5 minutes: 5-minute timeout
   * - 3rd timeout within 30 days: Ban
   * - 3 warnings within 30 days: Timeout
   * - 3 warnings + timeout within 30 days: Ban
   * 
   * @param violationsIn5min - Number of violations in the last 5 minutes
   * @param violationsIn30days - Number of violations in the last 30 days
   * @param warningsIn30days - Number of warnings in the last 30 days
   * @param timeoutsIn30days - Number of timeouts in the last 30 days
   * @returns Escalation result with punishment level
   */
  private calculateEscalation(
    violationsIn5min: number,
    violationsIn30days: number,
    warningsIn30days: number,
    timeoutsIn30days: number
  ): EscalationResult {
    // 3 warnings + timeout within 30 days = BAN
    if (warningsIn30days >= 3 && timeoutsIn30days >= 1) {
      return {
        punishmentLevel: PunishmentLevel.BAN,
        violationCount: violationsIn30days + 1,
        reason: `3 warnings + timeout within 30 days`,
        shouldNotify: true,
      };
    }

    // 3rd timeout within 30 days = BAN
    if (timeoutsIn30days >= 2) {
      return {
        punishmentLevel: PunishmentLevel.BAN,
        violationCount: violationsIn30days + 1,
        reason: `3rd timeout within 30 days`,
        shouldNotify: true,
      };
    }

    // 3 warnings within 30 days = TIMEOUT
    if (warningsIn30days >= 3) {
      return {
        punishmentLevel: PunishmentLevel.TIMEOUT_5M,
        violationCount: violationsIn30days + 1,
        reason: `3 warnings within 30 days`,
        shouldNotify: true,
      };
    }

    // 2nd spam within 5 minutes = 5-minute timeout
    if (violationsIn5min >= 1) {
      return {
        punishmentLevel: PunishmentLevel.TIMEOUT_5M,
        violationCount: violationsIn5min + 1,
        reason: `2nd spam within 5 minutes`,
        shouldNotify: true,
      };
    }

    // 1st spam = Warning (expires in 30 days)
    return {
      punishmentLevel: PunishmentLevel.WARNING,
      violationCount: 1,
      reason: `1st spam warning (expires in 30 days)`,
      shouldNotify: true,
    };
  }

  /**
   * Get severity score for a punishment level
   * Used for database storage and sorting
   */
  private getSeverityScore(level: PunishmentLevel): number {
    const severityMap: Record<PunishmentLevel, number> = {
      [PunishmentLevel.WARNING]: 1,
      [PunishmentLevel.TIMEOUT_5M]: 2,
      [PunishmentLevel.TIMEOUT_1H]: 3,
      [PunishmentLevel.TIMEOUT_24H]: 4,
      [PunishmentLevel.BAN]: 5,
    };
    return severityMap[level];
  }

  /**
   * Check if a user's violations have expired (30 days of no violations)
   * Requirements 4.6: Reset violation count after 30 days
   * 
   * @param userId - Discord user ID
   * @param currentTime - Current timestamp (defaults to now)
   * @returns True if violations should be cleared
   */
  async shouldClearViolations(
    userId: string,
    currentTime: Date = new Date()
  ): Promise<boolean> {
    const thirtyDaysAgo = new Date(currentTime.getTime() - ESCALATION_WINDOWS.THIRTY_DAYS);
    const recentViolations = await this.violationRepo.getCount(userId, thirtyDaysAgo);
    
    // If no violations in the last 30 days, check if there are any older violations to clear
    if (recentViolations === 0) {
      const latestViolation = await this.violationRepo.getLatest(userId);
      return latestViolation !== null;
    }
    
    return false;
  }

  /**
   * Clear expired violations for a user
   * Should be called periodically or when checking violation status
   * 
   * @param userId - Discord user ID
   */
  async clearExpiredViolations(userId: string): Promise<void> {
    const shouldClear = await this.shouldClearViolations(userId);
    if (shouldClear) {
      await this.violationRepo.clear(userId);
    }
  }

  /**
   * Get the current violation count for a user within a time window
   * 
   * @param userId - Discord user ID
   * @param windowMs - Time window in milliseconds
   * @param referenceTime - Reference time (defaults to now)
   * @returns Number of violations within the window
   */
  async getViolationCount(
    userId: string,
    windowMs: number,
    referenceTime: Date = new Date()
  ): Promise<number> {
    const windowStart = new Date(referenceTime.getTime() - windowMs);
    return await this.violationRepo.getCount(userId, windowStart);
  }

  /**
   * Get the next punishment level for a user without recording a violation
   * Useful for previewing what would happen
   * 
   * @param userId - Discord user ID
   * @param timestamp - Reference timestamp (defaults to now)
   * @returns The punishment level that would be applied
   */
  async getNextPunishmentLevel(
    userId: string,
    timestamp: Date = new Date()
  ): Promise<PunishmentLevel> {
    const fiveMinutesAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.FIVE_MINUTES);
    const thirtyDaysAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.THIRTY_DAYS);

    const violationsIn5min = await this.violationRepo.getCount(userId, fiveMinutesAgo);
    const violationsIn30days = await this.violationRepo.getCount(userId, thirtyDaysAgo);
    
    const warningsIn30days = await this.violationRepo.getCountByPunishment(
      userId,
      thirtyDaysAgo,
      PunishmentLevel.WARNING
    );
    const timeoutsIn30days = await this.violationRepo.getCountByPunishment(
      userId,
      thirtyDaysAgo,
      [PunishmentLevel.TIMEOUT_5M, PunishmentLevel.TIMEOUT_1H, PunishmentLevel.TIMEOUT_24H]
    );

    const escalation = this.calculateEscalation(
      violationsIn5min,
      violationsIn30days,
      warningsIn30days,
      timeoutsIn30days
    );
    return escalation.punishmentLevel;
  }
}
