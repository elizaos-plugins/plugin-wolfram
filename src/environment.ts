import { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

/**
 * Schema for Wolfram API configuration
 */
const wolframEnvSchema = z.object({
  // Wolfram Alpha API configuration
  WOLFRAM_APP_ID: z.string().min(1).describe("Wolfram Alpha App ID"),

  // Optional: Wolfram Cloud configuration for advanced features
  WOLFRAM_CLOUD_API_KEY: z
    .string()
    .optional()
    .describe("Wolfram Cloud API Key for advanced features"),

  // Optional: Custom endpoint for Wolfram services
  WOLFRAM_API_ENDPOINT: z
    .string()
    .url()
    .optional()
    .default("https://api.wolframalpha.com/v2"),

  // Optional: Response format preferences
  WOLFRAM_OUTPUT_FORMAT: z
    .enum(["plaintext", "image", "mathml", "sound", "wav"])
    .optional()
    .default("plaintext"),

  // Optional: Timeout settings
  WOLFRAM_TIMEOUT: z.number().min(1000).max(30000).optional().default(10000),

  // Optional: Units preference
  WOLFRAM_UNITS: z.enum(["metric", "imperial"]).optional().default("metric"),

  // Optional: Location for location-based queries
  WOLFRAM_LOCATION: z
    .string()
    .optional()
    .describe('Location for location-based queries (e.g., "New York, NY")'),

  // Optional: Scanner types to use
  WOLFRAM_SCANNERS: z
    .string()
    .optional()
    .describe("Comma-separated list of scanner types to use"),

  // Optional: Max results per query
  WOLFRAM_MAX_RESULTS: z.number().min(1).max(10).optional().default(5),
});

export type WolframConfig = z.infer<typeof wolframEnvSchema>;

/**
 * Validates Wolfram configuration from runtime environment
 */
export async function validateWolframConfig(
  runtime: IAgentRuntime,
): Promise<WolframConfig> {
  try {
    const config = {
      WOLFRAM_APP_ID:
        runtime.getSetting("WOLFRAM_APP_ID") ||
        runtime.getSetting("WOLFRAM_ALPHA_APP_ID"),
      WOLFRAM_CLOUD_API_KEY: runtime.getSetting("WOLFRAM_CLOUD_API_KEY"),
      WOLFRAM_API_ENDPOINT: runtime.getSetting("WOLFRAM_API_ENDPOINT"),
      WOLFRAM_OUTPUT_FORMAT: runtime.getSetting("WOLFRAM_OUTPUT_FORMAT"),
      WOLFRAM_TIMEOUT: runtime.getSetting("WOLFRAM_TIMEOUT")
        ? parseInt(runtime.getSetting("WOLFRAM_TIMEOUT"), 10)
        : undefined,
      WOLFRAM_UNITS: runtime.getSetting("WOLFRAM_UNITS"),
      WOLFRAM_LOCATION: runtime.getSetting("WOLFRAM_LOCATION"),
      WOLFRAM_SCANNERS: runtime.getSetting("WOLFRAM_SCANNERS"),
      WOLFRAM_MAX_RESULTS: runtime.getSetting("WOLFRAM_MAX_RESULTS")
        ? parseInt(runtime.getSetting("WOLFRAM_MAX_RESULTS"), 10)
        : undefined,
    };

    // Filter out undefined values
    const cleanConfig = Object.fromEntries(
      Object.entries(config).filter(([_, v]) => v !== undefined && v !== null),
    );

    return wolframEnvSchema.parse(cleanConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(
        `Wolfram configuration validation failed:\n${errorMessages}`,
      );
    }
    throw error;
  }
}

/**
 * Checks if Wolfram configuration is available
 */
export function isWolframConfigured(runtime: IAgentRuntime): boolean {
  const appId =
    runtime.getSetting("WOLFRAM_APP_ID") ||
    runtime.getSetting("WOLFRAM_ALPHA_APP_ID");
  return !!appId;
}
