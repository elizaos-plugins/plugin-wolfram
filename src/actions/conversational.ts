import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
  logger,
  ActionExample,
} from "@elizaos/core";
import { ActionResult } from "../types";
import { WolframService, WOLFRAM_SERVICE_NAME } from "../service";

export const wolframConversationalAction: Action = {
  name: "WOLFRAM_CONVERSATIONAL",
  description:
    "Have a conversational interaction with Wolfram Alpha that maintains context across queries",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService(WOLFRAM_SERVICE_NAME);
    return service instanceof WolframService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
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

      // Access previous action results to maintain context
      const context = options?.context;
      const previousConversation = context?.getPreviousResult?.(
        "WOLFRAM_CONVERSATIONAL",
      );
      const previousQuery = context?.getPreviousResult?.("WOLFRAM_QUERY");

      const userInput = message.content.text || "";
      const userId = message.userId;

      if (!userInput) {
        const errorMessage =
          "Please provide a question or topic for discussion.";

        await callback?.({
          text: errorMessage,
          error: true,
        } as Content);

        return {
          success: false,
          text: errorMessage,
        };
      }

      logger.log(`💬 Conversational query: "${userInput}"`);

      // Send initial feedback
      await callback?.({
        text: "Processing your question...",
      } as Content);

      // Use conversational API for context-aware responses
      const result = await service.conversationalQuery(userInput, userId);

      if (result.error) {
        const errorMessage = `Conversation error: ${result.error}`;

        await callback?.({
          text: errorMessage,
          error: true,
        } as Content);

        return {
          success: false,
          text: errorMessage,
          error: result.error,
        };
      }

      const response =
        result.result || "I couldn't generate a response for that question.";

      // Send the response
      await callback?.({
        text: response,
        metadata: {
          conversationID: result.conversationID,
          source: "Wolfram Alpha Conversational",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: response,
        values: {
          lastConversationQuery: userInput,
          conversationID: result.conversationID,
          conversationTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_CONVERSATIONAL",
          query: userInput,
          response: response,
          conversationID: result.conversationID,
          previousConversationData: previousConversation?.data || null,
          previousQueryData: previousQuery?.data || null,
          hasContext: !!previousConversation?.data?.conversationID,
        },
      };
    } catch (error) {
      logger.error("Error in conversational query:", error);
      const errorMessage = `Failed to process conversational query: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "Let's talk about prime numbers" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll start a conversation about prime numbers with Wolfram Alpha.",
          actions: ["WOLFRAM_CONVERSATIONAL"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What are the first 10?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Continuing our conversation about prime numbers...",
          actions: ["WOLFRAM_CONVERSATIONAL"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Which one is the largest below 100?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me find that in the context of our prime numbers discussion.",
          actions: ["WOLFRAM_CONVERSATIONAL"],
        },
      } as ActionExample,
    ],
  ],
};
