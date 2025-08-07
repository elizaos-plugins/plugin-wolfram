import { TestSuite, IAgentRuntime } from "@elizaos/core";
import { WolframService, WOLFRAM_SERVICE_NAME } from "../service";
import { isWolframConfigured } from "../environment";

export class WolframTestSuite implements TestSuite {
  name = "wolfram";
  private service: WolframService | null = null;

  async beforeAll(runtime: IAgentRuntime): Promise<void> {
    if (!isWolframConfigured(runtime)) {
      console.warn("⚠️ Wolfram tests skipped - WOLFRAM_APP_ID not configured");
      return;
    }

    this.service = runtime.getService(WOLFRAM_SERVICE_NAME) as WolframService;
    if (this.service) {
      await this.service.initialize();
    }
  }

  async afterAll(_runtime: IAgentRuntime): Promise<void> {
    if (this.service) {
      this.service.clearCache();
    }
  }

  tests = [
    {
      name: "should initialize Wolfram service",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(WolframService);
      },
    },
    {
      name: "should perform basic computation",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const result = await service.compute("2 + 2");
        expect(result).toBeDefined();
        expect(result).toContain("4");
      },
    },
    {
      name: "should solve equations",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const result = await service.solveMath("x + 3 = 7");
        expect(result).toBeDefined();
        expect(result.toLowerCase()).toContain("x");
      },
    },
    {
      name: "should get facts about topics",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const facts = await service.getFacts("Earth");
        expect(facts).toBeDefined();
        expect(Array.isArray(facts)).toBe(true);
        expect(facts.length).toBeGreaterThan(0);
      },
    },
    {
      name: "should get quick answers",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const result = await service.getShortAnswer("speed of light");
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        if (result.success) {
          expect(result.answer).toBeDefined();
        }
      },
    },
    {
      name: "should handle conversational queries",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const userId = "test-user-" + Date.now();
        const result = await service.conversationalQuery(
          "Tell me about prime numbers",
          userId,
        );

        expect(result).toBeDefined();
        if (result.conversationID) {
          // Clear conversation after test
          service.clearConversation(userId);
        }
      },
    },
    {
      name: "should format query results properly",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const mockResult = {
          success: true,
          numpods: 2,
          pods: [
            {
              title: "Input",
              id: "Input",
              scanner: "Identity",
              position: 100,
              error: false,
              numsubpods: 1,
              subpods: [{ plaintext: "2+2" }],
            },
            {
              title: "Result",
              id: "Result",
              scanner: "Simplification",
              position: 200,
              error: false,
              numsubpods: 1,
              subpods: [{ plaintext: "4" }],
            },
          ],
        };

        const formatted = service.formatResult(mockResult);
        expect(formatted).toBeDefined();
        expect(formatted).toContain("Result");
        expect(formatted).not.toContain("Input");
      },
    },
    {
      name: "should cache results properly",
      async fn(runtime: IAgentRuntime) {
        const service = runtime.getService(
          WOLFRAM_SERVICE_NAME,
        ) as WolframService;
        if (!service) {
          console.warn("Service not available, skipping test");
          return;
        }

        const statsBefore = service.getStats();
        const initialCacheSize = statsBefore.cacheSize;

        // Make a query that should be cached
        await service.compute("3 * 3");

        const statsAfter = service.getStats();
        expect(statsAfter.cacheSize).toBeGreaterThan(initialCacheSize);

        // Clear cache
        service.clearCache();
        const statsCleared = service.getStats();
        expect(statsCleared.cacheSize).toBe(0);
      },
    },
  ];
}

// Export test suite for use with elizaos test runner
export default new WolframTestSuite();
