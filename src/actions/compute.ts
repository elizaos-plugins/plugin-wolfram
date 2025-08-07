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

const computeTemplate = `
You are helping the user with a mathematical computation using Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants to compute: "{{userInput}}"

Extract the mathematical expression or calculation that should be computed.
Return ONLY the expression, nothing else. Examples:
- "2 + 2"
- "sqrt(144)"
- "integrate x^2 dx"
- "derivative of sin(x)"
`;

export const wolframComputeAction: Action = {
  name: "WOLFRAM_COMPUTE",
  description:
    "Perform mathematical computations using Wolfram Alpha, including arithmetic, algebra, calculus, and more",

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

      // Generate the expression from the user's input
      state = state || (await runtime.composeState(message));

      const computePrompt = composePromptFromState({
        state,
        template: computeTemplate,
      });

      const expressionResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: computePrompt,
      });

      const expression = expressionResult.trim();
      logger.log(`🔢 Computing: "${expression}"`);

      if (!expression) {
        const errorMessage =
          "I couldn't understand the expression to compute. Please provide a valid mathematical expression.";

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
        text: `Computing: "${expression}"...`,
      } as Content);

      // Execute the computation
      const result = await service.compute(expression);

      // Send the result
      await callback?.({
        text: `Result: ${result}`,
        metadata: {
          expression,
          result,
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: `Result: ${result}`,
        values: {
          lastComputation: expression,
          lastResult: result,
          computationTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_COMPUTE",
          expression: expression,
          result: result,
          previousQueryData: previousQuery?.data || null,
        },
      };
    } catch (error) {
      logger.error("Error computing expression:", error);
      const errorMessage = `Failed to compute: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "Calculate 15% of 250" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll calculate 15% of 250 for you.",
          actions: ["WOLFRAM_COMPUTE"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What is the square root of 2024?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me compute the square root of 2024.",
          actions: ["WOLFRAM_COMPUTE"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Calculate the derivative of x^3 + 2x^2 - 5x + 1" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll calculate the derivative of that polynomial.",
          actions: ["WOLFRAM_COMPUTE"],
        },
      } as ActionExample,
    ],
  ],
};
