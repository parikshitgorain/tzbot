export interface Migration {
    version: number;
    name: string;
    upPath: string;
    downPath: string;
}
/**
 * Run all pending migrations
 * Automatically runs on startup per requirements
 */
export declare function runMigrations(): Promise<void>;
/**
 * Rollback to a specific version
 * Used for development/testing
 */
export declare function rollbackTo(targetVersion: number): Promise<void>;
/**
 * Get migration status
 */
export declare function getMigrationStatus(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: number;
    appliedMigrations: Migration[];
}>;
//# sourceMappingURL=migrator.d.ts.map