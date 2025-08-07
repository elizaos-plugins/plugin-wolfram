import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IAgentRuntime } from '@elizaos/core';
import { WolframService } from '../src/service';
import { validateWolframConfig } from '../src/environment';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
    })),
  },
}));

// Mock the environment validation
vi.mock('../src/environment', () => ({
  validateWolframConfig: vi.fn(),
  isWolframConfigured: vi.fn(() => true),
}));

describe('WolframService', () => {
  let service: WolframService;
  let mockRuntime: IAgentRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRuntime = {
      getSetting: vi.fn((key: string) => {
        const settings: Record<string, string> = {
          WOLFRAM_APP_ID: 'test-app-id',
          WOLFRAM_API_ENDPOINT: 'https://api.wolframalpha.com/v2',
          WOLFRAM_TIMEOUT: '10000',
          WOLFRAM_UNITS: 'metric',
        };
        return settings[key];
      }),
      composeState: vi.fn(),
      getService: vi.fn(),
    } as unknown as IAgentRuntime;

    (validateWolframConfig as any).mockResolvedValue({
      WOLFRAM_APP_ID: 'test-app-id',
      WOLFRAM_API_ENDPOINT: 'https://api.wolframalpha.com/v2',
      WOLFRAM_TIMEOUT: 10000,
      WOLFRAM_UNITS: 'metric',
      WOLFRAM_MAX_RESULTS: 5,
    });

    service = new WolframService(mockRuntime);
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should throw error with invalid API key', async () => {
      (validateWolframConfig as any).mockRejectedValue(
        new Error('Invalid API key')
      );
      
      await expect(service.initialize()).rejects.toThrow('Invalid API key');
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should execute a query successfully', async () => {
      const mockResponse = {
        data: {
          queryresult: {
            success: true,
            numpods: 2,
            pods: [
              {
                title: 'Input',
                id: 'Input',
                subpods: [{ plaintext: '2+2' }],
              },
              {
                title: 'Result',
                id: 'Result',
                subpods: [{ plaintext: '4' }],
              },
            ],
          },
        },
      };

      const mockClient = {
        get: vi.fn().mockResolvedValue(mockResponse),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);

      const result = await service.query('2+2');
      
      expect(result.success).toBe(true);
      expect(result.numpods).toBe(2);
      expect(result.pods).toHaveLength(2);
    });

    it('should use cache for repeated queries', async () => {
      const mockResponse = {
        data: {
          queryresult: {
            success: true,
            numpods: 1,
            pods: [],
          },
        },
      };

      const mockClient = {
        get: vi.fn().mockResolvedValue(mockResponse),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);

      // First query
      await service.query('test query');
      // Second query (should use cache)
      await service.query('test query');

      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('compute', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should compute mathematical expressions', async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: '42' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);

      const result = await service.compute('6 * 7');
      
      expect(result).toBe('42');
    });
  });

  describe('solveMath', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should solve equations', async () => {
      const mockResponse = {
        data: {
          queryresult: {
            success: true,
            pods: [
              {
                title: 'Solution',
                id: 'Solution',
                subpods: [{ plaintext: 'x = 2' }],
              },
            ],
          },
        },
      };

      const mockClient = {
        get: vi.fn().mockResolvedValue(mockResponse),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);

      const result = await service.solveMath('x + 3 = 5');
      
      expect(result).toBe('x = 2');
    });
  });

  describe('formatResult', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should format successful results', () => {
      const queryResult = {
        success: true,
        numpods: 2,
        pods: [
          {
            title: 'Input',
            id: 'Input',
            scanner: 'Identity',
            position: 100,
            error: false,
            numsubpods: 1,
            subpods: [{ plaintext: '2+2' }],
          },
          {
            title: 'Result',
            id: 'Result',
            scanner: 'Simplification',
            position: 200,
            error: false,
            numsubpods: 1,
            subpods: [{ plaintext: '4' }],
          },
        ],
      };

      const formatted = service.formatResult(queryResult);
      
      expect(formatted).toContain('Result');
      expect(formatted).toContain('4');
      expect(formatted).not.toContain('Input'); // Input pod should be skipped
    });

    it('should handle failed results', () => {
      const queryResult = {
        success: false,
        error: 'No results found',
      };

      const formatted = service.formatResult(queryResult);
      
      expect(formatted).toBe('No results found');
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should clear cache', () => {
      // Add some data to cache
      (service as any).cache.set('test-key', {
        query: 'test',
        result: 'test-result',
        timestamp: Date.now(),
        ttl: 3600000,
      });

      expect((service as any).cache.size).toBe(1);
      
      service.clearCache();
      
      expect((service as any).cache.size).toBe(0);
    });

    it('should clean expired cache entries', () => {
      const now = Date.now();
      
      // Add expired entry
      (service as any).cache.set('expired', {
        query: 'expired',
        result: 'expired-result',
        timestamp: now - 7200000, // 2 hours ago
        ttl: 3600000, // 1 hour TTL
      });

      // Add valid entry
      (service as any).cache.set('valid', {
        query: 'valid',
        result: 'valid-result',
        timestamp: now - 1800000, // 30 minutes ago
        ttl: 3600000, // 1 hour TTL
      });

      (service as any).cleanCache();
      
      expect((service as any).cache.has('expired')).toBe(false);
      expect((service as any).cache.has('valid')).toBe(true);
    });
  });

  describe('conversational queries', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should handle conversational queries', async () => {
      const mockResponse = {
        data: {
          conversationID: 'conv-123',
          result: 'Prime numbers are natural numbers greater than 1...',
          s: 'Success',
        },
      };

      const mockClient = {
        get: vi.fn().mockResolvedValue(mockResponse),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);

      const result = await service.conversationalQuery(
        'Tell me about prime numbers',
        'user-123'
      );
      
      expect(result.conversationID).toBe('conv-123');
      expect(result.result).toContain('Prime numbers');
    });

    it('should clear conversation for a user', () => {
      (service as any).conversationCache.set('user-123', 'conv-123');
      
      expect((service as any).conversationCache.has('user-123')).toBe(true);
      
      service.clearConversation('user-123');
      
      expect((service as any).conversationCache.has('user-123')).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      const mockClient = {
        get: vi.fn().mockResolvedValue({ data: 'true' }),
      };
      vi.spyOn(service as any, 'client', 'get').mockReturnValue(mockClient);
      await service.initialize();
    });

    it('should return service statistics', () => {
      const stats = service.getStats();
      
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('activeConversations');
      expect(stats).toHaveProperty('config');
      expect(stats.config).toHaveProperty('units');
      expect(stats.config.units).toBe('metric');
    });
  });
});
