/**
 * @file setup.ts
 * @description Global test setup and mocks for Vitest
 */

import { vi, beforeAll } from 'vitest';

// Suppress console output during tests unless explicitly needed
beforeAll(() => {
  // Keep error logs visible but suppress info/debug
  const originalConsoleInfo = console.info;
  const originalConsoleLog = console.log;
  const originalConsoleDebug = console.debug;
  
  console.info = vi.fn();
  console.log = vi.fn();
  console.debug = vi.fn();
  
  // Restore on test completion if needed
  return () => {
    console.info = originalConsoleInfo;
    console.log = originalConsoleLog;
    console.debug = originalConsoleDebug;
  };
});
