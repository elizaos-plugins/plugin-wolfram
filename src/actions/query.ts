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

const queryTemplate = `
You are helping the user with a Wolfram Alpha query.

Recent conversation context:
{{recentMessages}}

The user wants to know: "{{userInput}}"

Extract the query that should be sent to Wolfram Alpha. Make it clear and specific.
Return ONLY the query text, nothing else.
`;

export const wolframQueryAction: Action = {
  name: "WOLFRAM_QUERY",
  description:
    "Query Wolfram Alpha for comprehensive information about any topic, including mathematics, science, geography, history, and more",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService(WOLFRAM_SERVICE_NAME);
    return service instanceof WolframService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: any,
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

      // Generate the query from the user's input
      state = state || (await runtime.composeState(message));

      const queryPrompt = composePromptFromState({
        state,
        template: queryTemplate,
      });

      const queryResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: queryPrompt,
      });

      const query = queryResult.trim();
      logger.log(`🔍 Wolfram query: "${query}"`);

      if (!query) {
        const errorMessage =
          "I couldn't understand your query. Please try rephrasing.";

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
        text: `Searching Wolfram Alpha for: "${query}"...`,
      } as Content);

      // Execute the query
      const result = await service.query(query);

      // Format the response
      const formattedResult = service.formatResult(result);

      // Send final result
      await callback?.({
        text: formattedResult,
        metadata: {
          query,
          success: result.success,
          numpods: result.numpods,
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: formattedResult,
        values: {
          lastWolframQuery: query,
          lastQueryTime: Date.now(),
          querySuccess: result.success,
        },
        data: {
          actionName: "WOLFRAM_QUERY",
          query: query,
          result: result,
          formattedResult: formattedResult,
          pods: result.pods?.length || 0,
          success: result.success,
          numpods: result.numpods,
        },
      };
    } catch (error) {
      logger.error("Error executing Wolfram query:", error);
      const errorMessage = `Failed to query Wolfram Alpha: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "What is the population of Tokyo?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll look up the population of Tokyo for you.",
          actions: ["WOLFRAM_QUERY"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What is the integral of x^2?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me calculate the integral of x^2.",
          actions: ["WOLFRAM_QUERY"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What's the weather in New York?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll check the current weather in New York.",
          actions: ["WOLFRAM_QUERY"],
        },
      } as ActionExample,
    ],
  ],
};
