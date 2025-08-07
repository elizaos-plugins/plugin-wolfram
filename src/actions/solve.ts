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
} from '@elizaos/core';
import { WolframService, WOLFRAM_SERVICE_NAME } from '../service';

const solveTemplate = `
You are helping the user solve an equation or mathematical problem.

Recent conversation context:
{{recentMessages}}

The user wants to solve: "{{userInput}}"

Extract the equation or problem that needs to be solved.
Return ONLY the equation or problem statement, nothing else.
Examples: "x^2 + 5x + 6 = 0", "2x + 3 = 7", "system: x+y=5, x-y=1"
`;

export const wolframSolveAction: Action = {
  name: 'WOLFRAM_SOLVE',
  description: 'Solve mathematical equations and problems using Wolfram Alpha',
  
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService(WOLFRAM_SERVICE_NAME);
    return service instanceof WolframService;
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: any,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    try {
      const service = runtime.getService(WOLFRAM_SERVICE_NAME) as unknown as WolframService;
      
      if (!service) {
        logger.error('Wolfram service not found');
        if (callback) {
          await callback({
            text: 'Wolfram service is not available. Please check the configuration.',
            error: true,
          } as Content);
        }
        return false;
      }

      // Generate the equation from the user's input
      state = state || await runtime.composeState(message);
      
      const solvePrompt = composePromptFromState({
        state,
        template: solveTemplate,
      });
      
      const equationResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: solvePrompt,
      });
      
      const equation = equationResult.trim();
      logger.log(`🧮 Solving: "${equation}"`);
      
      // Solve the equation
      const solution = await service.solveMath(equation);
      
      if (callback) {
        await callback({
          text: `**Problem:** ${equation}\n**Solution:** ${solution}`,
          metadata: {
            equation,
            solution,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error solving equation:', error);
      
      if (callback) {
        await callback({
          text: `Failed to solve equation: ${error instanceof Error ? error.message : String(error)}`,
          error: true,
        } as Content);
      }
      
      return false;
    }
  },
  
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Solve x^2 - 4x + 3 = 0' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll solve this quadratic equation for you.',
          actions: ['WOLFRAM_SOLVE'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Find x if 3x + 7 = 22' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me solve for x in this equation.',
          actions: ['WOLFRAM_SOLVE'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Solve the system: x + y = 10 and x - y = 2' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll solve this system of equations.',
          actions: ['WOLFRAM_SOLVE'],
        },
      } as ActionExample,
    ],
  ],
};
