import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  logger,
  ProviderResult,
} from "@elizaos/core";
import { WolframService, WOLFRAM_SERVICE_NAME } from "../service";

export const wolframComputationProvider: Provider = {
  name: "wolfram_computation",
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
  ): Promise<ProviderResult> => {
    try {
      const service = runtime.getService(
        WOLFRAM_SERVICE_NAME,
      ) as unknown as WolframService;

      if (!service) {
        return { text: "", values: {}, data: {} };
      }

      // Check if the message contains mathematical expressions or computational queries
      const text = message.content.text?.toLowerCase() || "";
      const computationalKeywords = [
        "calculate",
        "compute",
        "solve",
        "integral",
        "derivative",
        "equation",
        "math",
        "formula",
        "sum",
        "product",
        "factorial",
        "prime",
        "factor",
        "graph",
        "plot",
        "statistics",
        "mean",
        "median",
        "standard deviation",
        "correlation",
        "regression",
      ];

      const hasComputationalContent = computationalKeywords.some((keyword) =>
        text.includes(keyword),
      );

      // Check for mathematical symbols and patterns
      const hasMathSymbols = /[+\-*/^=<>]|\d+/.test(text);
      const hasEquation = /\w+\s*=\s*\w+/.test(text);
      const hasFunction = /\w+\([^)]*\)/.test(text);

      if (
        !hasComputationalContent &&
        !hasMathSymbols &&
        !hasEquation &&
        !hasFunction
      ) {
        return { text: "", values: {}, data: {} };
      }

      // Provide computational context
      const context = [
        "The Wolfram Alpha computational engine is available for:",
        "- Mathematical calculations and equation solving",
        "- Step-by-step solutions for problems",
        "- Data analysis and statistics",
        "- Scientific computations and conversions",
        "- Facts and information about any topic",
        "",
        "You can ask for calculations, solve equations, analyze data, or get facts about any subject.",
      ];

      return {
        text: context.join("\n"),
        values: {
          hasComputationalContent,
          hasMathSymbols,
        },
        data: {
          provider: "wolfram_computation",
        },
      };
    } catch (error) {
      logger.error("Error in Wolfram computation provider:", error);
      return { text: "", values: {}, data: {} };
    }
  },
};
