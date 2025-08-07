import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
  logger,
  composePromptFromState,
  ModelType,
  ActionExample,
} from "@elizaos/core";
import { ActionResult } from "../types";
import { WolframService, WOLFRAM_SERVICE_NAME } from "../service";

const analyzeDataTemplate = `
You are helping the user analyze data using Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants to analyze: "{{userInput}}"

Extract the data or dataset that needs to be analyzed. This could be:
- A list of numbers (e.g., "1, 2, 3, 4, 5")
- A data description (e.g., "heights: 170cm, 165cm, 180cm, 175cm")
- A statistical query (e.g., "mean of 10, 20, 30, 40")

Return ONLY the data or analysis request, nothing else.
`;

export const wolframAnalyzeDataAction: Action = {
  name: "WOLFRAM_ANALYZE_DATA",
  description: "Analyze data and get statistical insights using Wolfram Alpha",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService(WOLFRAM_SERVICE_NAME);
    return service instanceof WolframService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService(
        WOLFRAM_SERVICE_NAME,
      ) as unknown as WolframService;

      if (!service) {
        logger.error("Wolfram service not found");
        const errorMessage =
          "Wolfram service is not available. Please check the configuration.";

        await callback?.({
          text: errorMessage,
          error: true,
        } as Content);

        return {
          success: false,
          text: errorMessage,
          error: "Service not available",
        };
      }

      // Access previous action results if available
      const context = options?.context;
      const previousCompute = context?.getPreviousResult?.("WOLFRAM_COMPUTE");
      const previousQuery = context?.getPreviousResult?.("WOLFRAM_QUERY");

      // Generate the data from the user's input
      state = state || (await runtime.composeState(message));

      const dataPrompt = composePromptFromState({
        state,
        template: analyzeDataTemplate,
      });

      const dataResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: dataPrompt,
      });

      const data = dataResult.trim();
      logger.log(`📊 Analyzing data: "${data}"`);

      if (!data) {
        const errorMessage =
          "I couldn't understand the data to analyze. Please provide valid data or a clear description.";

        await callback?.({
          text: errorMessage,
          error: true,
        } as Content);

        return {
          success: false,
          text: errorMessage,
        };
      }

      // Send initial feedback
      await callback?.({
        text: `Analyzing data: "${data.substring(0, 50)}${data.length > 50 ? "..." : ""}"`,
      } as Content);

      // Analyze the data
      const analysis = await service.analyzeData(data);

      // Format the response
      let formattedAnalysis = "Data Analysis Results:\n\n";
      if (analysis.error) {
        formattedAnalysis = `Error: ${analysis.error}`;
      } else if (analysis.results) {
        for (const [key, value] of Object.entries(analysis.results)) {
          formattedAnalysis += `${key}:\n${Array.isArray(value) ? value.join("\n") : value}\n\n`;
        }
      }

      // Send the analysis
      await callback?.({
        text: formattedAnalysis,
        metadata: {
          data: data.substring(0, 100),
          analysisType: Object.keys(analysis.results || {}),
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: formattedAnalysis,
        values: {
          lastAnalyzedData: data,
          analysisTime: Date.now(),
          analysisResultsCount: Object.keys(analysis.results || {}).length,
        },
        data: {
          actionName: "WOLFRAM_ANALYZE_DATA",
          data: data,
          analysis: analysis,
          formattedAnalysis: formattedAnalysis,
          resultsCount: Object.keys(analysis.results || {}).length,
          previousComputeData: previousCompute?.data || null,
          previousQueryData: previousQuery?.data || null,
        },
      };
    } catch (error) {
      logger.error("Error analyzing data:", error);
      const errorMessage = `Failed to analyze data: ${error instanceof Error ? error.message : String(error)}`;

      await callback?.({
        text: errorMessage,
        error: true,
      } as Content);

      return {
        success: false,
        text: errorMessage,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Analyze this data: 12, 15, 18, 22, 25, 28, 31" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll analyze this dataset for you.",
          actions: ["WOLFRAM_ANALYZE_DATA"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "What's the standard deviation of 100, 105, 110, 115, 120?",
        },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me calculate the statistical analysis for this data.",
          actions: ["WOLFRAM_ANALYZE_DATA"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Find the correlation between (1,2), (2,4), (3,6), (4,8)",
        },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll analyze the correlation in this dataset.",
          actions: ["WOLFRAM_ANALYZE_DATA"],
        },
      } as ActionExample,
    ],
  ],
};
