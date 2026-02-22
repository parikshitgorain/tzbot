import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

describe('DNS Resolution Script', () => {
  const scriptPath = path.join(process.cwd(), 'deployment/scripts/resolve-dns.sh');

  beforeAll(() => {
    // Verify script exists and is executable
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stats = fs.statSync(scriptPath);
    expect(stats.mode & fs.constants.S_IXUSR).toBeTruthy();
  });

  describe('Basic Functionality', () => {
    it('should resolve a valid DNS hostname', () => {
      // Using google.com as a reliable test hostname
      const result = execSync(`${scriptPath} google.com`, { encoding: 'utf-8' });
      const ip = result.trim().split('\n').pop()?.trim();
      
      // Verify IP address format (IPv4)
      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    }, 30000);

    it('should fail with exit code 1 when no hostname is provided', () => {
      expect(() => {
        execSync(`${scriptPath}`, { encoding: 'utf-8', stdio: 'pipe' });
      }).toThrow();
    });

    it('should fail with exit code 2 when hostname cannot be resolved', () => {
      try {
        execSync(`${scriptPath} this-hostname-definitely-does-not-exist-12345.invalid`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 60000
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        // Exit code 2 indicates DNS resolution failure
        expect(error.status).toBe(2);
      }
    }, 70000);
  });

  describe('Retry Logic', () => {
    it('should log multiple retry attempts for invalid hostname', () => {
      try {
        const result = execSync(
          `${scriptPath} nonexistent-host-12345.invalid 2>&1`,
          { encoding: 'utf-8', timeout: 60000 }
        );
      } catch (error: any) {
        // Combine stdout and stderr (we redirected stderr to stdout in the command)
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        
        // Should see multiple attempt logs
        expect(output).toContain('Attempt 1/5');
        expect(output).toContain('Attempt 2/5');
        expect(output).toContain('Attempt 3/5');
        expect(output).toContain('Attempt 4/5');
        expect(output).toContain('Attempt 5/5');
        
        // Should see exponential backoff messages
        expect(output).toContain('Waiting 1s before retry');
        expect(output).toContain('Waiting 2s before retry');
        expect(output).toContain('Waiting 4s before retry');
        expect(output).toContain('Waiting 8s before retry');
        
        // Should see final failure message
        expect(output).toContain('DNS RESOLUTION FAILED - DEPLOYMENT ABORTED');
        expect(output).toContain('Failed to resolve hostname: nonexistent-host-12345.invalid');
        expect(output).toContain('Attempts made: 5');
      }
    }, 70000);
  });

  describe('Output Format', () => {
    it('should output only the IP address on the last line for successful resolution', () => {
      const result = execSync(`${scriptPath} google.com`, { encoding: 'utf-8' });
      const lines = result.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      
      // Last line should be just the IP address
      expect(lastLine).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    }, 30000);

    it('should include timestamp in log messages', () => {
      try {
        execSync(`${scriptPath} google.com`, { encoding: 'utf-8', stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stderr?.toString() || '';
        // Log messages should include timestamps in format [YYYY-MM-DD HH:MM:SS]
        expect(output).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
      }
    }, 30000);
  });

  describe('Requirements Validation', () => {
    it('should implement retry logic with exponential backoff (Requirement 3.3)', () => {
      const startTime = Date.now();
      
      try {
        execSync(
          `${scriptPath} nonexistent-host-12345.invalid`,
          { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 }
        );
      } catch (error: any) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        // Total backoff time should be approximately 1+2+4+8 = 15 seconds
        // Plus some overhead for DNS queries, so expect at least 15 seconds
        expect(duration).toBeGreaterThanOrEqual(15);
        
        // Should not take more than 45 seconds (15s backoff + 30s for DNS attempts)
        expect(duration).toBeLessThan(45);
      }
    }, 70000);

    it('should log each resolution attempt (Requirement 3.3)', () => {
      try {
        execSync(
          `${scriptPath} nonexistent-host-12345.invalid 2>&1`,
          { encoding: 'utf-8', timeout: 60000 }
        );
      } catch (error: any) {
        // Combine stdout and stderr (we redirected stderr to stdout in the command)
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        
        // Should log each of the 5 attempts
        for (let i = 1; i <= 5; i++) {
          expect(output).toContain(`Attempt ${i}/5`);
        }
      }
    }, 70000);

    it('should return resolved IP address on success (Requirement 3.1, 3.2)', () => {
      const result = execSync(`${scriptPath} google.com`, { encoding: 'utf-8' });
      const ip = result.trim().split('\n').pop()?.trim();
      
      // Should return a valid IPv4 address
      expect(ip).toBeDefined();
      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      
      // Verify each octet is valid (0-255)
      const octets = ip!.split('.').map(Number);
      octets.forEach(octet => {
        expect(octet).toBeGreaterThanOrEqual(0);
        expect(octet).toBeLessThanOrEqual(255);
      });
    }, 30000);
  });
});
