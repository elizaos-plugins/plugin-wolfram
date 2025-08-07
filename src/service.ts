import { IAgentRuntime, Service, logger } from "@elizaos/core";
import { validateWolframConfig, WolframConfig } from "./environment";
import {
  WolframAlphaQueryResult,
  WolframSimpleResult,
  WolframShortAnswerResult,
  WolframSpokenResult,
  WolframConversationResult,
  WolframLLMOptions,
  WolframQueryOptions,
  WolframAPIEndpoint,
  WolframCacheEntry,
  WolframPod,
  WolframAnalysisResult,
  WolframServiceStats,
} from "./types";

export const WOLFRAM_SERVICE_NAME = "wolfram";

// Type definition for axios to avoid importing directly
interface AxiosInstance {
  get: (url: string, config?: any) => Promise<any>;
  defaults: any;
}

export class WolframService extends Service {
  static serviceType = WOLFRAM_SERVICE_NAME;
  capabilityDescription =
    "Provides Wolfram Alpha computational knowledge and mathematical problem solving";

  wolframConfig!: WolframConfig;
  client!: AxiosInstance;
  cache: Map<string, WolframCacheEntry>;
  conversationCache: Map<string, string>; // userId -> conversationID
  readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  readonly MAX_CACHE_ENTRIES = 200; // Cap cache size to avoid unbounded growth

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.cache = new Map();
    this.conversationCache = new Map();
  }

  async initialize(): Promise<void> {
    logger.log("🐺 Initializing Wolfram service...");

    try {
      this.wolframConfig = await validateWolframConfig(this.runtime);

      // Dynamic import axios to avoid build issues
      const axios = (await import("axios" as any)) as any;
      this.client = axios.default.create({
        baseURL:
          this.wolframConfig.WOLFRAM_API_ENDPOINT ||
          "https://api.wolframalpha.com/v2",
        timeout: this.wolframConfig.WOLFRAM_TIMEOUT || 10000,
        headers: {
          "User-Agent": "ElizaOS-Wolfram-Plugin/1.0",
        },
      });

      // Note: LLM and Conversation requests will use absolute URLs with this client

      // Test the API connection
      await this.validateApiKey();

      logger.log("✅ Wolfram service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Wolfram service:", error);
      throw error;
    }
  }

  /**
   * Validates the API key by making a test request
   */
  private async validateApiKey(): Promise<void> {
    // Minimal validation by querying the Short Answer API
    try {
      const response = await this.client.get("/short", {
        params: {
          appid: this.wolframConfig.WOLFRAM_APP_ID,
          input: "2+2",
        },
      });
      if (!response?.data || typeof response.data !== "string") {
        throw new Error("Unexpected validation response");
      }
    } catch (error) {
      logger.error("Failed to validate Wolfram API key:", error);
      throw new Error("Invalid or missing Wolfram Alpha App ID");
    }
  }

  /**
   * Lightweight retry for transient errors (429/5xx)
   */
  private async getWithRetry(
    client: AxiosInstance,
    url: string,
    config: any,
    maxRetries: number = 2,
  ): Promise<any> {
    let attempt = 0;
    let delayMs = 250;
    // Use absolute minimal jitter/backoff
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await client.get(url, config);
      } catch (err: any) {
        const status = err?.response?.status;
        const retriable = status === 429 || (status >= 500 && status < 600);
        if (!retriable || attempt >= maxRetries) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delayMs));
        attempt += 1;
        delayMs *= 2;
      }
    }
  }

  /**
   * Main query method for full Wolfram Alpha results
   */
  async query(
    input: string,
    options: Partial<WolframQueryOptions> = {},
  ): Promise<WolframAlphaQueryResult> {
    const cacheKey = `query:${input}:${JSON.stringify(options)}`;

    // Check cache
    const cached = this.getCached(cacheKey);
    if (cached) {
      logger.log("🎯 Returning cached Wolfram query result");
      return cached as WolframAlphaQueryResult;
    }

    try {
      logger.log(`🔍 Querying Wolfram Alpha: "${input}"`);

      const params: WolframQueryOptions = {
        input,
        appid: this.wolframConfig.WOLFRAM_APP_ID,
        format: "plaintext,image",
        output: "json",
        units: this.wolframConfig.WOLFRAM_UNITS,
        ...options,
      };

      if (this.wolframConfig.WOLFRAM_LOCATION && !params.location) {
        params.location = this.wolframConfig.WOLFRAM_LOCATION;
      }

      if (this.wolframConfig.WOLFRAM_SCANNERS && !params.scanner) {
        params.scanner = this.wolframConfig.WOLFRAM_SCANNERS;
      }

      const response = await this.getWithRetry(this.client, WolframAPIEndpoint.QUERY, {
        params,
      });

      const result: WolframAlphaQueryResult = response.data.queryresult;

      if (result.success) {
        this.setCached(cacheKey, result);
        logger.log(`✅ Wolfram query successful with ${result.numpods} pods`);
      } else {
        logger.warn(`⚠️ Wolfram query returned no results for: "${input}"`);
      }

      return result;
    } catch (error) {
      logger.error("❌ Wolfram query failed:", error);
      throw new Error(
        `Wolfram query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Simple API - returns a single image result
   */
  async getSimpleAnswer(input: string): Promise<string> {
    const cacheKey = `simple:${input}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      logger.log(`🖼️ Getting simple answer for: "${input}"`);

      const response = await this.getWithRetry(this.client, WolframAPIEndpoint.SIMPLE, {
        params: {
          appid: this.wolframConfig.WOLFRAM_APP_ID,
          input,
          units: this.wolframConfig.WOLFRAM_UNITS,
          location: this.wolframConfig.WOLFRAM_LOCATION,
        },
        responseType: "arraybuffer",
      });

      // Convert to base64 for easy storage/transmission
      const base64 = Buffer.from(response.data).toString("base64");
      const imageUrl = `data:image/gif;base64,${base64}`;

      this.setCached(cacheKey, imageUrl);
      return imageUrl;
    } catch (error) {
      logger.error("Failed to get simple answer:", error);
      throw new Error(
        `Simple answer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Short Answer API - returns a single plaintext result
   */
  async getShortAnswer(input: string): Promise<WolframShortAnswerResult> {
    const cacheKey = `short:${input}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as WolframShortAnswerResult;
    }

    try {
      logger.log(`📝 Getting short answer for: "${input}"`);

      const response = await this.getWithRetry(this.client, WolframAPIEndpoint.SHORT, {
        params: {
          appid: this.wolframConfig.WOLFRAM_APP_ID,
          input,
          units: this.wolframConfig.WOLFRAM_UNITS,
          location: this.wolframConfig.WOLFRAM_LOCATION,
        },
      });

      const result: WolframShortAnswerResult = {
        answer: response.data,
        success: true,
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error("Failed to get short answer:", error);
      return {
        answer: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Spoken Answer API - returns natural language response
   */
  async getSpokenAnswer(input: string): Promise<WolframSpokenResult> {
    const cacheKey = `spoken:${input}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as WolframSpokenResult;
    }

    try {
      logger.log(`🗣️ Getting spoken answer for: "${input}"`);

      const response = await this.getWithRetry(this.client, WolframAPIEndpoint.SPOKEN, {
        params: {
          appid: this.wolframConfig.WOLFRAM_APP_ID,
          input,
          units: this.wolframConfig.WOLFRAM_UNITS,
          location: this.wolframConfig.WOLFRAM_LOCATION,
        },
      });

      const result: WolframSpokenResult = {
        spoken: response.data,
        success: true,
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error("Failed to get spoken answer:", error);
      return {
        spoken: "",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Conversational API - supports multi-turn conversations
   */
  async conversationalQuery(
    input: string,
    userId: string,
    maxChars: number = 2000,
  ): Promise<WolframConversationResult> {
    try {
      logger.log(`💬 Conversational query from user ${userId}: "${input}"`);

      // Get or create conversation ID for this user
      let conversationID = this.conversationCache.get(userId);

      const params: WolframLLMOptions = {
        input,
        appid: this.wolframConfig.WOLFRAM_APP_ID,
        maxchars: maxChars,
      };

      if (conversationID) {
        params.conversationID = conversationID;
      }

      // Use llmClient with absolute/override baseURL if provided in config
      const llmUrl = this.wolframConfig.WOLFRAM_LLM_API_ENDPOINT || WolframAPIEndpoint.LLM;
      const headers = this.wolframConfig.WOLFRAM_CLOUD_API_KEY
        ? { "X-Wolfram-Cloud-Api-Key": this.wolframConfig.WOLFRAM_CLOUD_API_KEY }
        : undefined;
      const response = await this.getWithRetry(this.client, llmUrl, {
        params,
        headers,
      });

      const result: WolframConversationResult = response.data;

      // Store conversation ID for future queries
      if (result.conversationID) {
        this.conversationCache.set(userId, result.conversationID);
      }

      logger.log(`✅ Conversational response received`);
      return result;
    } catch (error) {
      logger.error("Error in conversational query:", error);
      throw new Error(
        `Conversational query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Clear conversation context for a user
   */
  clearConversation(userId: string): void {
    this.conversationCache.delete(userId);
    logger.log(`🔄 Cleared conversation for user ${userId}`);
  }

  /**
   * Specialized method for solving mathematical equations
   */
  async solveMath(equation: string): Promise<string> {
    const cacheKey = `solve:${equation}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      logger.log(`🧮 Solving equation: "${equation}"`);

      const result = await this.query(`solve ${equation}`);

      if (!result.success || !result.pods) {
        return "Could not solve the equation";
      }

      // Look for solution pods
      const solutionPod = result.pods.find(
        (pod) =>
          pod.title === "Solution" ||
          pod.title === "Result" ||
          pod.title.includes("solution"),
      );

      if (solutionPod && solutionPod.subpods && solutionPod.subpods[0]) {
        const solution =
          solutionPod.subpods[0].plaintext || "No solution found";
        this.setCached(cacheKey, solution);
        return solution;
      }

      return "No solution found";
    } catch (error) {
      logger.error("Error solving equation:", error);
      throw new Error(
        `Failed to solve equation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get step-by-step solutions for problems
   */
  async getStepByStep(problem: string): Promise<string[]> {
    const cacheKey = `steps:${problem}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as string[];
    }

    try {
      logger.log(`📋 Getting step-by-step solution for: "${problem}"`);

      const result = await this.query(problem, {
        podstate: "Step-by-step solution",
      });

      if (!result.success || !result.pods) {
        return ["Could not generate step-by-step solution"];
      }

      const steps: string[] = [];

      // Look for step-by-step pods
      for (const pod of result.pods) {
        if (
          pod.title.includes("step") ||
          pod.title.includes("Step") ||
          pod.scanner === "Solve"
        ) {
          for (const subpod of pod.subpods || []) {
            if (subpod.plaintext) {
              steps.push(subpod.plaintext);
            }
          }
        }
      }

      if (steps.length === 0) {
        // Fallback to all pods
        for (const pod of result.pods) {
          if (pod.subpods) {
            for (const subpod of pod.subpods) {
              if (subpod.plaintext) {
                steps.push(`${pod.title}: ${subpod.plaintext}`);
              }
            }
          }
        }
      }

      this.setCached(cacheKey, steps);
      return steps.length > 0 ? steps : ["No step-by-step solution available"];
    } catch (error) {
      logger.error("Error getting step-by-step solution:", error);
      throw new Error(
        `Failed to get step-by-step solution: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compute mathematical expressions
   */
  async compute(expression: string): Promise<string> {
    const cacheKey = `compute:${expression}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as string;
    }

    try {
      logger.log(`🔢 Computing: "${expression}"`);

      const shortAnswer = await this.getShortAnswer(expression);

      if (shortAnswer.success && shortAnswer.answer) {
        this.setCached(cacheKey, shortAnswer.answer);
        return shortAnswer.answer;
      }

      // Fallback to full query if short answer fails
      const result = await this.query(expression);

      if (result.success && result.pods && result.pods.length > 0) {
        // Look for result/value pods
        const resultPod = result.pods.find(
          (pod) =>
            pod.title === "Result" ||
            pod.title === "Value" ||
            pod.title === "Decimal approximation",
        );

        if (resultPod && resultPod.subpods && resultPod.subpods[0]) {
          const answer = resultPod.subpods[0].plaintext || "No result";
          this.setCached(cacheKey, answer);
          return answer;
        }
      }

      return "Could not compute expression";
    } catch (error) {
      logger.error("Error computing expression:", error);
      throw new Error(
        `Failed to compute: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get facts about a topic
   */
  async getFacts(topic: string): Promise<string[]> {
    const cacheKey = `facts:${topic}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached as string[];
    }

    try {
      logger.log(`📚 Getting facts about: "${topic}"`);

      const result = await this.query(topic);

      if (!result.success || !result.pods) {
        return [`No facts found about ${topic}`];
      }

      const facts: string[] = [];

      // Collect facts from various pods
      for (const pod of result.pods) {
        if (pod.subpods) {
          for (const subpod of pod.subpods) {
            if (subpod.plaintext && subpod.plaintext.length > 10) {
              facts.push(`${pod.title}: ${subpod.plaintext}`);
            }
          }
        }
      }

      this.setCached(cacheKey, facts);
      return facts.length > 0 ? facts : [`No facts found about ${topic}`];
    } catch (error) {
      logger.error("Error getting facts:", error);
      throw new Error(
        `Failed to get facts: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Analyze data and provide statistical insights
   */
  async analyzeData(data: string): Promise<WolframAnalysisResult> {
    const cacheKey = `analyze:${data}`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      logger.log(`📊 Analyzing data: "${data}"`);

      const result = await this.query(`statistics ${data}`);

      if (!result.success || !result.pods) {
        return { input: data, results: {}, error: "Could not analyze data" };
      }

      const analysis: WolframAnalysisResult = {
        input: data,
        results: {},
      };

      // Extract statistical results
      for (const pod of result.pods) {
        if (pod.subpods) {
          const podData: string[] = [];
          for (const subpod of pod.subpods) {
            if (subpod.plaintext) {
              podData.push(subpod.plaintext);
            }
          }
          if (podData.length > 0) {
            analysis.results[pod.title] = podData;
          }
        }
      }

      this.setCached(cacheKey, analysis);
      return analysis;
    } catch (error) {
      logger.error("Error analyzing data:", error);
      throw new Error(
        `Failed to analyze data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Format Wolfram Alpha results for display
   */
  formatResult(result: WolframAlphaQueryResult): string {
    if (!result.success) {
      return "No results found";
    }

    const output: string[] = [];

    if (result.pods) {
      // Prefer primary pods; skip "Input" pods explicitly
      const pods = result.pods.filter((p) => p.title !== "Input");
      const primaryPods = pods.filter((p) => p.primary);
      const podsToRender = primaryPods.length > 0 ? primaryPods : pods;

      for (const pod of podsToRender) {
        if (!pod.subpods || pod.subpods.length === 0) continue;
        output.push(`**${pod.title}**`);
        for (const subpod of pod.subpods) {
          if (subpod.plaintext) {
            output.push(subpod.plaintext);
          }
        }
      }
    }

    if (result.assumptions) {
      output.push("\n*Assumptions:*");
      for (const assumption of result.assumptions) {
        if (assumption.values) {
          output.push(`- ${assumption.values.map((v) => v.desc).join(", ")}`);
        }
      }
    }

    if (result.warnings) {
      output.push("\n*Warnings:*");
      for (const warning of result.warnings) {
        output.push(`- ${warning.text}`);
      }
    }

    return output.join("\n") || "No results to display";
  }

  /**
   * Cache management methods
   */
  private getCached(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private setCached(
    key: string,
    result: any,
    ttl: number = this.CACHE_TTL,
  ): void {
    this.cache.set(key, {
      query: key,
      result,
      timestamp: Date.now(),
      ttl,
    });

    // Clean old cache entries
    this.cleanCache();

    // Enforce max cache size (drop oldest)
    if (this.cache.size > this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  private cleanCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.conversationCache.clear();
    logger.log("🗑️ Wolfram cache cleared");
  }

  /**
   * Get service statistics
   */
  getStats(): WolframServiceStats {
    return {
      cacheSize: this.cache.size,
      activeConversations: this.conversationCache.size,
      config: {
        units: this.wolframConfig.WOLFRAM_UNITS,
        location: this.wolframConfig.WOLFRAM_LOCATION,
        maxResults: this.wolframConfig.WOLFRAM_MAX_RESULTS,
      },
    };
  }

  /**
   * Stop the service and clean up resources
   */
  async stop(): Promise<void> {
    logger.log("🛑 Stopping Wolfram service...");
    this.clearCache();
    logger.log("✅ Wolfram service stopped");
  }
}
