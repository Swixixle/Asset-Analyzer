/**
 * Tests for server/config.ts
 * 
 * Tests the deterministic bind configuration and environment loading.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock process.env before importing
const originalEnv = process.env;

beforeEach(() => {
  // Reset process.env to a clean state
  process.env = { ...originalEnv };
  
  // Clear the module cache to get fresh imports
  vi.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('getBindConfig', () => {
  it('should default to port 5000 when PORT is not set', async () => {
    delete process.env.PORT;
    process.env.NODE_ENV = 'development';
    
    const { getBindConfig } = await import('../config');
    const config = getBindConfig();
    
    expect(config.port).toBe(5000);
    expect(config.host).toBe('0.0.0.0');
  });
  
  it('should use PORT environment variable when set', async () => {
    process.env.PORT = '1234';
    process.env.NODE_ENV = 'development';
    
    const { getBindConfig } = await import('../config');
    const config = getBindConfig();
    
    expect(config.port).toBe(1234);
  });
  
  it('should use HOST environment variable when set', async () => {
    process.env.HOST = '127.0.0.1';
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'development';
    
    const { getBindConfig } = await import('../config');
    const config = getBindConfig();
    
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
  });
  
  it('should warn and fallback to 5000 for invalid PORT in development', async () => {
    process.env.PORT = 'abc';
    process.env.NODE_ENV = 'development';
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const { getBindConfig } = await import('../config');
    const config = getBindConfig();
    
    expect(config.port).toBe(5000);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid PORT')
    );
    
    consoleWarnSpy.mockRestore();
  });
  
  it('should throw error for invalid PORT in production', async () => {
    process.env.PORT = 'abc';
    process.env.NODE_ENV = 'production';
    
    const { getBindConfig } = await import('../config');
    
    expect(() => getBindConfig()).toThrow('Invalid PORT');
  });
  
  it('should throw error for out-of-range PORT in production', async () => {
    process.env.PORT = '99999';
    process.env.NODE_ENV = 'production';
    
    const { getBindConfig } = await import('../config');
    
    expect(() => getBindConfig()).toThrow('Invalid PORT');
  });
  
  it('should accept PORT=0 (let OS assign) in development', async () => {
    process.env.PORT = '0';
    process.env.NODE_ENV = 'development';
    
    const { getBindConfig } = await import('../config');
    const config = getBindConfig();
    
    // Port 0 is technically invalid for our use case
    expect(config.port).toBe(5000);
  });
});

describe('getConfig', () => {
  it('should load basic configuration', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    
    const { getConfig } = await import('../config');
    const config = getConfig();
    
    expect(config.nodeEnv).toBe('development');
    expect(config.isDevelopment).toBe(true);
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(3000);
  });
  
  it('should detect production environment', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PORT = '5000';
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.ADMIN_KEY = 'a'.repeat(32);
    
    const { getConfig } = await import('../config');
    const config = getConfig();
    
    expect(config.isProduction).toBe(true);
    expect(config.isDevelopment).toBe(false);
  });
  
  it('should detect CI enabled when GITHUB_WEBHOOK_SECRET is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.GITHUB_WEBHOOK_SECRET = 'secret123';
    
    const { getConfig } = await import('../config');
    const config = getConfig();
    
    expect(config.githubWebhookSecret).toBe('secret123');
  });
  
  it('should detect semantic/AI enabled when keys are set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

    const { getConfig } = await import('../config');
    const config = getConfig();

    expect(config.aiEnabled).toBe(true);
    expect(config.aiOpenaiApiKey).toBe('sk-test');
  });
});

describe('getBootReport', () => {
  it('should generate boot report with all fields', async () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = 'postgresql://test';
    
    const { getConfig, getBootReport } = await import('../config');
    const config = getConfig();
    const report = getBootReport(config);
    
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('tool_version');
    expect(report.tool_version).toMatch(/^pta-/);
    expect(report).not.toHaveProperty('app_version'); // Verify old field is removed
    expect(report.node_env).toBe('development');
    expect(report.bind_host).toBe('0.0.0.0');
    expect(report.bind_port).toBe(3000);
    expect(report.db_configured).toBe(true);
    expect(report).toHaveProperty('ci_enabled');
    expect(report).toHaveProperty('semantic_enabled');
  });
});
