/**
 * @file violation-tracker.ts
 * @description Violation tracking system (stub - not yet implemented)
 * @module moderation
 */

import type { ViolationRepository } from '@/core/database/repositories/ViolationRepository.js';
import type { ViolationType, PunishmentLevel } from '@/types/models.js';

/**
 * ViolationTracker class (stub implementation)
 * TODO: Implement full violation tracking functionality
 */
export class ViolationTracker {
  constructor(private violationRepository: ViolationRepository) {
    // Stub implementation - repository will be used when implemented
    void this.violationRepository;
  }

  async recordViolation(
    _userId: string,
    _type: ViolationType,
    _details: string,
  ): Promise<{ violationId: string; punishment: PunishmentLevel }> {
    throw new Error('ViolationTracker not yet implemented');
  }

  async getViolationCount(_userId: string): Promise<number> {
    throw new Error('ViolationTracker not yet implemented');
  }

  async clearViolations(_userId: string): Promise<void> {
    throw new Error('ViolationTracker not yet implemented');
  }
}
