import type { Pool } from 'pg';
import type { Violation, ViolationType, PunishmentLevel } from '../../../types/models.js';

/**
 * ViolationRepository handles all violation-related database operations
 * Tracks user violations for spam escalation and moderation
 */
export class ViolationRepository {
  constructor(private pool: Pool) {}

  /**
   * Save a new violation record
   * Used when a user violates rules (spam, malicious links, etc.)
   */
  async save(violation: Omit<Violation, 'id'>): Promise<string> {
    const query = `
      INSERT INTO violations (user_id, type, severity, timestamp, details, punishment_applied)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [
        violation.userId,
        violation.type,
        violation.severity,
        violation.timestamp,
        violation.details,
        violation.punishmentApplied || null,
      ]);

      return result.rows[0].id;
    } catch (error) {
      throw new Error(`Failed to save violation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all violations for a user since a specific date
   * Used for escalation matrix calculations
   */
  async get(userId: string, since: Date): Promise<Violation[]> {
    const query = `
      SELECT id, user_id, type, severity, timestamp, details, punishment_applied
      FROM violations
      WHERE user_id = $1 AND timestamp >= $2
      ORDER BY timestamp DESC
    `;

    try {
      const result = await this.pool.query(query, [userId, since]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        type: row.type as ViolationType,
        severity: row.severity,
        timestamp: row.timestamp,
        details: row.details,
        punishmentApplied: row.punishment_applied as PunishmentLevel | undefined,
      }));
    } catch (error) {
      throw new Error(`Failed to get violations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get violation count for a user within a time window
   * Used for spam detection and escalation
   */
  async getCount(userId: string, since: Date, type?: ViolationType): Promise<number> {
    let query = `
      SELECT COUNT(*) as count
      FROM violations
      WHERE user_id = $1 AND timestamp >= $2
    `;

    const params: (string | Date)[] = [userId, since];

    if (type) {
      query += ' AND type = $3';
      params.push(type);
    }

    try {
      const result = await this.pool.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new Error(`Failed to get violation count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all violations for a user
   * Used when violation expiry period passes (7 days)
   */
  async clear(userId: string): Promise<void> {
    const query = 'DELETE FROM violations WHERE user_id = $1';

    try {
      await this.pool.query(query, [userId]);
    } catch (error) {
      throw new Error(`Failed to clear violations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear old violations (older than 7 days)
   * Should be run periodically as a cleanup job
   */
  async clearOldViolations(olderThan: Date): Promise<number> {
    const query = `
      DELETE FROM violations 
      WHERE timestamp < $1
      RETURNING id
    `;

    try {
      const result = await this.pool.query(query, [olderThan]);
      return result.rowCount || 0;
    } catch (error) {
      throw new Error(`Failed to clear old violations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the most recent violation for a user
   * Used to determine next punishment level
   */
  async getLatest(userId: string): Promise<Violation | null> {
    const query = `
      SELECT id, user_id, type, severity, timestamp, details, punishment_applied
      FROM violations
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        type: row.type as ViolationType,
        severity: row.severity,
        timestamp: row.timestamp,
        details: row.details,
        punishmentApplied: row.punishment_applied as PunishmentLevel | undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get latest violation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get violation count by punishment level within a time window
   * Used for progressive punishment system
   */
  async getCountByPunishment(
    userId: string,
    since: Date,
    punishmentLevel: PunishmentLevel | PunishmentLevel[],
  ): Promise<number> {
    const punishmentLevels = Array.isArray(punishmentLevel) ? punishmentLevel : [punishmentLevel];

    const query = `
      SELECT COUNT(*) as count
      FROM violations
      WHERE user_id = $1 
        AND timestamp >= $2
        AND punishment_applied = ANY($3)
    `;

    try {
      const result = await this.pool.query(query, [userId, since, punishmentLevels]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new Error(`Failed to get violation count by punishment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
