import { describe, it, expect, beforeEach } from 'vitest';
import { IAgentRuntime } from '@elizaos/core';
import { validateWolframConfig, isWolframConfigured } from '../src/environment';

describe('Wolfram Environment Configuration', () => {
  let mockRuntime: IAgentRuntime;

  beforeEach(() => {
    mockRuntime = {
      getSetting: (key: string) => {
        const settings: Record<string, string> = {
          WOLFRAM_APP_ID: 'test-app-id',
        };
        return settings[key];
      },
    } as IAgentRuntime;
  });

  describe('validateWolframConfig', () => {
    it('should validate correct configuration', async () => {
      const config = await validateWolframConfig(mockRuntime);
      
      expect(config).toBeDefined();
      expect(config.WOLFRAM_APP_ID).toBe('test-app-id');
      expect(config.WOLFRAM_API_ENDPOINT).toBe('https://api.wolframalpha.com/v2');
      expect(config.WOLFRAM_OUTPUT_FORMAT).toBe('plaintext');
      expect(config.WOLFRAM_TIMEOUT).toBe(10000);
      expect(config.WOLFRAM_UNITS).toBe('metric');
      expect(config.WOLFRAM_MAX_RESULTS).toBe(5);
    });

    it('should accept WOLFRAM_ALPHA_APP_ID as alternative', async () => {
      const altRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_ALPHA_APP_ID: 'alt-app-id',
          };
          return settings[key];
        },
      } as IAgentRuntime;

      const config = await validateWolframConfig(altRuntime);
      
      expect(config.WOLFRAM_APP_ID).toBe('alt-app-id');
    });

    it('should throw error when WOLFRAM_APP_ID is missing', async () => {
      const invalidRuntime = {
        getSetting: () => undefined,
      } as IAgentRuntime;

      await expect(validateWolframConfig(invalidRuntime)).rejects.toThrow(
        'Wolfram configuration validation failed'
      );
    });

    it('should validate custom settings', async () => {
      const customRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_APP_ID: 'test-app-id',
            WOLFRAM_CLOUD_API_KEY: 'cloud-key',
            WOLFRAM_API_ENDPOINT: 'https://custom.wolfram.com',
            WOLFRAM_OUTPUT_FORMAT: 'image',
            WOLFRAM_TIMEOUT: '5000',
            WOLFRAM_UNITS: 'imperial',
            WOLFRAM_LOCATION: 'New York, NY',
            WOLFRAM_SCANNERS: 'Data,Solve',
            WOLFRAM_MAX_RESULTS: '3',
          };
          return settings[key];
        },
      } as IAgentRuntime;

      const config = await validateWolframConfig(customRuntime);
      
      expect(config.WOLFRAM_CLOUD_API_KEY).toBe('cloud-key');
      expect(config.WOLFRAM_API_ENDPOINT).toBe('https://custom.wolfram.com');
      expect(config.WOLFRAM_OUTPUT_FORMAT).toBe('image');
      expect(config.WOLFRAM_TIMEOUT).toBe(5000);
      expect(config.WOLFRAM_UNITS).toBe('imperial');
      expect(config.WOLFRAM_LOCATION).toBe('New York, NY');
      expect(config.WOLFRAM_SCANNERS).toBe('Data,Solve');
      expect(config.WOLFRAM_MAX_RESULTS).toBe(3);
    });

    it('should reject invalid timeout values', async () => {
      const invalidRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_APP_ID: 'test-app-id',
            WOLFRAM_TIMEOUT: '50000', // Too high
          };
          return settings[key];
        },
      } as IAgentRuntime;

      await expect(validateWolframConfig(invalidRuntime)).rejects.toThrow(
        'Wolfram configuration validation failed'
      );
    });

    it('should reject invalid output format', async () => {
      const invalidRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_APP_ID: 'test-app-id',
            WOLFRAM_OUTPUT_FORMAT: 'invalid-format',
          };
          return settings[key];
        },
      } as IAgentRuntime;

      await expect(validateWolframConfig(invalidRuntime)).rejects.toThrow(
        'Wolfram configuration validation failed'
      );
    });

    it('should reject invalid units', async () => {
      const invalidRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_APP_ID: 'test-app-id',
            WOLFRAM_UNITS: 'invalid-units',
          };
          return settings[key];
        },
      } as IAgentRuntime;

      await expect(validateWolframConfig(invalidRuntime)).rejects.toThrow(
        'Wolfram configuration validation failed'
      );
    });

    it('should reject invalid max results', async () => {
      const invalidRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            WOLFRAM_APP_ID: 'test-app-id',
            WOLFRAM_MAX_RESULTS: '15', // Too high
          };
          return settings[key];
        },
      } as IAgentRuntime;

      await expect(validateWolframConfig(invalidRuntime)).rejects.toThrow(
        'Wolfram configuration validation failed'
      );
    });
  });

  describe('isWolframConfigured', () => {
    it('should return true when WOLFRAM_APP_ID is set', () => {
      const result = isWolframConfigured(mockRuntime);
      expect(result).toBe(true);
    });

    it('should return true when WOLFRAM_ALPHA_APP_ID is set', () => {
      const altRuntime = {
        getSetting: (key: string) => {
          if (key === 'WOLFRAM_ALPHA_APP_ID') return 'alt-app-id';
          return undefined;
        },
      } as IAgentRuntime;

      const result = isWolframConfigured(altRuntime);
      expect(result).toBe(true);
    });

    it('should return false when neither key is set', () => {
      const unconfiguredRuntime = {
        getSetting: () => undefined,
      } as IAgentRuntime;

      const result = isWolframConfigured(unconfiguredRuntime);
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const emptyRuntime = {
        getSetting: () => '',
      } as IAgentRuntime;

      const result = isWolframConfigured(emptyRuntime);
      expect(result).toBe(false);
    });
  });
});
