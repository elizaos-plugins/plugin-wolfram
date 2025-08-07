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

const quickAnswerTemplate = `
You are helping the user get a quick answer from Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants a quick answer for: "{{userInput}}"

Extract the question or query for a quick answer.
Return ONLY the question, nothing else. Examples:
- "speed of light"
- "capital of France"
- "boiling point of water"
- "pi to 10 digits"
`;

export const wolframQuickAnswerAction: Action = {
  name: "WOLFRAM_QUICK_ANSWER",
  description:
    "Get quick, concise answers to simple questions using Wolfram Alpha",

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
      const previousFacts = context?.getPreviousResult?.("WOLFRAM_GET_FACTS");

      // Generate the question from the user's input
      state = state || (await runtime.composeState(message));

      const questionPrompt = composePromptFromState({
        state,
        template: quickAnswerTemplate,
      });

      const questionResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: questionPrompt,
      });

      const question = questionResult.trim();
      logger.log(`⚡ Quick answer for: "${question}"`);

      if (!question) {
        const errorMessage =
          "I couldn't understand your question. Please ask a clear, simple question.";

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
        text: `Getting quick answer for: "${question}"...`,
      } as Content);

      // Get quick answer
      const result = await service.getShortAnswer(question);

      if (!result.success || !result.answer) {
        const errorMessage = `Couldn't find a quick answer for: "${question}"`;

        await callback?.({
          text: errorMessage,
          error: true,
        } as Content);

        return {
          success: false,
          text: errorMessage,
        };
      }

      // Send the answer
      await callback?.({
        text: result.answer,
        metadata: {
          question,
          source: "Wolfram Alpha Quick Answer",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: result.answer,
        values: {
          lastQuickQuestion: question,
          lastQuickAnswer: result.answer,
          quickAnswerTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_QUICK_ANSWER",
          question: question,
          answer: result.answer,
          previousQueryData: previousQuery?.data || null,
          previousFactsData: previousFacts?.data || null,
        },
      };
    } catch (error) {
      logger.error("Error getting quick answer:", error);
      const errorMessage = `Failed to get quick answer: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "What is the speed of light?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll get you a quick answer.",
          actions: ["WOLFRAM_QUICK_ANSWER"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "How many days in a leap year?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me find that quick answer for you.",
          actions: ["WOLFRAM_QUICK_ANSWER"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What's the boiling point of water in Celsius?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll get that information quickly.",
          actions: ["WOLFRAM_QUICK_ANSWER"],
        },
      } as ActionExample,
    ],
  ],
};
