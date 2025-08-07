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

const solveTemplate = `
You are helping the user solve an equation or system of equations using Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants to solve: "{{userInput}}"

Extract the equation or system that needs to be solved.
Return ONLY the equation(s), nothing else. Examples:
- "2x + 5 = 15"
- "x^2 - 4x + 3 = 0"
- "x + y = 10, x - y = 2"
`;

export const wolframSolveAction: Action = {
  name: "WOLFRAM_SOLVE",
  description: "Solve equations and systems of equations using Wolfram Alpha",

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

      // Generate the equation from the user's input
      state = state || (await runtime.composeState(message));

      const solvePrompt = composePromptFromState({
        state,
        template: solveTemplate,
      });

      const equationResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: solvePrompt,
      });

      const equation = equationResult.trim();
      logger.log(`🧮 Solving: "${equation}"`);

      if (!equation) {
        const errorMessage =
          "I couldn't understand the equation to solve. Please provide a valid equation.";

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
        text: `Solving equation: "${equation}"...`,
      } as Content);

      // Solve the equation
      const solution = await service.solveMath(equation);

      // Send the solution
      await callback?.({
        text: `Solution: ${solution}`,
        metadata: {
          equation,
          solution,
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: `Solution: ${solution}`,
        values: {
          lastEquation: equation,
          lastSolution: solution,
          solveTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_SOLVE",
          equation: equation,
          solution: solution,
          previousComputeData: previousCompute?.data || null,
          hasSolution: solution !== "No solution found",
        },
      };
    } catch (error) {
      logger.error("Error solving equation:", error);
      const errorMessage = `Failed to solve equation: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "Solve x^2 - 4x + 3 = 0" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll solve this quadratic equation for you.",
          actions: ["WOLFRAM_SOLVE"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Find x if 3x + 7 = 22" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me solve for x in this equation.",
          actions: ["WOLFRAM_SOLVE"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Solve the system: x + y = 10 and x - y = 2" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll solve this system of equations.",
          actions: ["WOLFRAM_SOLVE"],
        },
      } as ActionExample,
    ],
  ],
};
