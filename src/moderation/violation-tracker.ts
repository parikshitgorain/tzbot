/**
 * @file violation-tracker.ts
 * @description Violation tracking and escalation system for TZBOT
 * @module moderation
 * 
 * Implements the escalation matrix:
 * - 1st violation: Warning
 * - 2nd violation (within 24h): 1-hour timeout
 * - 3rd violation (within 24h): 24-hour timeout
 * - 4th violation (within 7 days): Permanent ban
 * 
 * Violations expire after 7 days of no violations
 * Validates: Requirements 4.1-4.4, 4.6
 */

import type { ViolationType } from '../types/models.js';
import { PunishmentLevel } from '../types/models.js';
import type { EscalationResult } from '../types/interfaces.js';
import type { ViolationRepository } from '../core/database/repositories/ViolationRepository.js';

/**
 * Time windows for escalation calculations
 */
const ESCALATION_WINDOWS = {
  /** 24 hours in milliseconds */
  TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,
  /** 7 days in milliseconds */
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * ViolationTracker class
 * Handles violation recording and escalation matrix logic
 */
export class ViolationTracker {
  constructor(private violationRepo: ViolationRepository) {}

  /**
   * Record a violation and determine the appropriate punishment level
   * Implements the escalation matrix from Requirements 4.1-4.4
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
    const twentyFourHoursAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.TWENTY_FOUR_HOURS);
    const sevenDaysAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.SEVEN_DAYS);

    const violationsIn24h = await this.violationRepo.getCount(userId, twentyFourHoursAgo);
    const violationsIn7d = await this.violationRepo.getCount(userId, sevenDaysAgo);

    // Determine punishment level based on escalation matrix
    const escalation = this.calculateEscalation(violationsIn24h, violationsIn7d);

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
   * Implements the escalation matrix:
   * - 1st violation: Warning
   * - 2nd violation (within 24h): 1-hour timeout
   * - 3rd violation (within 24h): 24-hour timeout
   * - 4th violation (within 7 days): Permanent ban
   * 
   * @param violationsIn24h - Number of violations in the last 24 hours
   * @param violationsIn7d - Number of violations in the last 7 days
   * @returns Escalation result with punishment level
   */
  private calculateEscalation(
    violationsIn24h: number,
    violationsIn7d: number
  ): EscalationResult {
    // This is the CURRENT violation, so we're checking previous violations
    // violationsIn24h and violationsIn7d are counts BEFORE this violation

    // 4th violation within 7 days = BAN
    if (violationsIn7d >= 3) {
      return {
        punishmentLevel: PunishmentLevel.BAN,
        violationCount: violationsIn7d + 1,
        reason: `4th violation within 7 days`,
        shouldNotify: true,
      };
    }

    // 3rd violation within 24 hours = 24-hour timeout
    if (violationsIn24h >= 2) {
      return {
        punishmentLevel: PunishmentLevel.TIMEOUT_24H,
        violationCount: violationsIn24h + 1,
        reason: `3rd violation within 24 hours`,
        shouldNotify: true,
      };
    }

    // 2nd violation within 24 hours = 1-hour timeout
    if (violationsIn24h >= 1) {
      return {
        punishmentLevel: PunishmentLevel.TIMEOUT_1H,
        violationCount: violationsIn24h + 1,
        reason: `2nd violation within 24 hours`,
        shouldNotify: true,
      };
    }

    // 1st violation = Warning
    return {
      punishmentLevel: PunishmentLevel.WARNING,
      violationCount: 1,
      reason: `1st violation`,
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
      [PunishmentLevel.TIMEOUT_1H]: 2,
      [PunishmentLevel.TIMEOUT_24H]: 3,
      [PunishmentLevel.BAN]: 4,
    };
    return severityMap[level];
  }

  /**
   * Check if a user's violations have expired (7 days of no violations)
   * Requirements 4.6: Reset violation count after 7 days
   * 
   * @param userId - Discord user ID
   * @param currentTime - Current timestamp (defaults to now)
   * @returns True if violations should be cleared
   */
  async shouldClearViolations(
    userId: string,
    currentTime: Date = new Date()
  ): Promise<boolean> {
    const sevenDaysAgo = new Date(currentTime.getTime() - ESCALATION_WINDOWS.SEVEN_DAYS);
    const recentViolations = await this.violationRepo.getCount(userId, sevenDaysAgo);
    
    // If no violations in the last 7 days, check if there are any older violations to clear
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
    const twentyFourHoursAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.TWENTY_FOUR_HOURS);
    const sevenDaysAgo = new Date(timestamp.getTime() - ESCALATION_WINDOWS.SEVEN_DAYS);

    const violationsIn24h = await this.violationRepo.getCount(userId, twentyFourHoursAgo);
    const violationsIn7d = await this.violationRepo.getCount(userId, sevenDaysAgo);

    const escalation = this.calculateEscalation(violationsIn24h, violationsIn7d);
    return escalation.punishmentLevel;
  }
}
