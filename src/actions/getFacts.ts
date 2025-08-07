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

const getFactsTemplate = `
You are helping the user get facts about a topic using Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants facts about: "{{userInput}}"

Extract the topic they want facts about.
Return ONLY the topic, nothing else. Examples:
- "Jupiter"
- "Albert Einstein"  
- "photosynthesis"
- "World War II"
`;

export const wolframGetFactsAction: Action = {
  name: "WOLFRAM_GET_FACTS",
  description: "Get facts and information about any topic using Wolfram Alpha",

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
      const previousQuery = context?.getPreviousResult?.("WOLFRAM_QUERY");

      // Generate the topic from the user's input
      state = state || (await runtime.composeState(message));

      const factsPrompt = composePromptFromState({
        state,
        template: getFactsTemplate,
      });

      const topicResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: factsPrompt,
      });

      const topic = topicResult.trim();
      logger.log(`📚 Getting facts about: "${topic}"`);

      if (!topic) {
        const errorMessage =
          "I couldn't understand the topic. Please specify what you want to learn about.";

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
        text: `Gathering facts about "${topic}"...`,
      } as Content);

      // Get facts
      const facts = await service.getFacts(topic);

      // Format the response
      const formattedFacts = facts.join("\n\n");

      // Send the facts
      await callback?.({
        text: formattedFacts,
        metadata: {
          topic,
          factsCount: facts.length,
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: formattedFacts,
        values: {
          lastFactsTopic: topic,
          factsCount: facts.length,
          factsTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_GET_FACTS",
          topic: topic,
          facts: facts,
          factsCount: facts.length,
          formattedFacts: formattedFacts,
          previousQueryData: previousQuery?.data || null,
        },
      };
    } catch (error) {
      logger.error("Error getting facts:", error);
      const errorMessage = `Failed to get facts: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "Tell me facts about Jupiter" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll get you facts about Jupiter.",
          actions: ["WOLFRAM_GET_FACTS"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What are some facts about Albert Einstein?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me find facts about Albert Einstein.",
          actions: ["WOLFRAM_GET_FACTS"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Give me information about the Eiffel Tower" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll gather facts about the Eiffel Tower.",
          actions: ["WOLFRAM_GET_FACTS"],
        },
      } as ActionExample,
    ],
  ],
};
