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

const stepByStepTemplate = `
You are helping the user get a step-by-step solution using Wolfram Alpha.

Recent conversation context:
{{recentMessages}}

The user wants step-by-step solution for: "{{userInput}}"

Extract the problem that needs step-by-step solution.
Return ONLY the problem statement, nothing else. Examples:
- "solve x^2 - 5x + 6 = 0"
- "integrate sin(x) dx"
- "factor x^3 - 8"
`;

export const wolframStepByStepAction: Action = {
  name: "WOLFRAM_STEP_BY_STEP",
  description:
    "Get step-by-step solutions for mathematical problems using Wolfram Alpha",

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
      const previousSolve = context?.getPreviousResult?.("WOLFRAM_SOLVE");
      const previousCompute = context?.getPreviousResult?.("WOLFRAM_COMPUTE");

      // Generate the problem from the user's input
      state = state || (await runtime.composeState(message));

      const stepPrompt = composePromptFromState({
        state,
        template: stepByStepTemplate,
      });

      const problemResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: stepPrompt,
      });

      const problem = problemResult.trim();
      logger.log(`📋 Getting step-by-step solution for: "${problem}"`);

      if (!problem) {
        const errorMessage =
          "I couldn't understand the problem. Please provide a clear problem statement.";

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
        text: `Getting step-by-step solution for: "${problem}"...`,
      } as Content);

      // Get step-by-step solution
      const steps = await service.getStepByStep(problem);

      // Format the response
      const formattedSteps = steps
        .map((step, index) => `Step ${index + 1}: ${step}`)
        .join("\n");

      // Send the solution
      await callback?.({
        text: formattedSteps,
        metadata: {
          problem,
          steps: steps.length,
          source: "Wolfram Alpha",
        },
      } as Content);

      // Return structured result for action chaining
      return {
        success: true,
        text: formattedSteps,
        values: {
          lastProblem: problem,
          stepsCount: steps.length,
          stepByStepTime: Date.now(),
        },
        data: {
          actionName: "WOLFRAM_STEP_BY_STEP",
          problem: problem,
          steps: steps,
          stepsCount: steps.length,
          formattedSteps: formattedSteps,
          previousSolveData: previousSolve?.data || null,
          previousComputeData: previousCompute?.data || null,
        },
      };
    } catch (error) {
      logger.error("Error getting step-by-step solution:", error);
      const errorMessage = `Failed to get step-by-step solution: ${error instanceof Error ? error.message : String(error)}`;

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
        content: { text: "Show me how to solve x^2 - 6x + 8 = 0 step by step" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll show you the step-by-step solution for this quadratic equation.",
          actions: ["WOLFRAM_STEP_BY_STEP"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "How do I integrate x * sin(x) dx?" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "Let me show you the step-by-step integration process.",
          actions: ["WOLFRAM_STEP_BY_STEP"],
        },
      } as ActionExample,
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Walk me through factoring x^3 - 27" },
      } as ActionExample,
      {
        name: "{{agent}}",
        content: {
          text: "I'll provide step-by-step factorization.",
          actions: ["WOLFRAM_STEP_BY_STEP"],
        },
      } as ActionExample,
    ],
  ],
};
