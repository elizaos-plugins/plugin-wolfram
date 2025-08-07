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

const computeTemplate = `
You are helping the user with a mathematical computation.

Recent conversation context:
{{recentMessages}}

The user wants to compute: "{{userInput}}"

Extract the mathematical expression or calculation that needs to be computed.
Return ONLY the expression, nothing else.
Examples: "2+2", "sqrt(144)", "derivative of x^3", "integral of sin(x)"
`;

export const wolframComputeAction: Action = {
  name: 'WOLFRAM_COMPUTE',
  description: 'Perform mathematical calculations and computations using Wolfram Alpha',
  
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

      // Generate the expression from the user's input
      state = state || await runtime.composeState(message);
      
      const computePrompt = composePromptFromState({
        state,
        template: computeTemplate,
      });
      
      const expressionResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: computePrompt,
      });
      
      const expression = expressionResult.trim();
      logger.log(`🔢 Computing: "${expression}"`);
      
      // Execute the computation
      const result = await service.compute(expression);
      
      if (callback) {
        await callback({
          text: `**Calculation:** ${expression}\n**Result:** ${result}`,
          metadata: {
            expression,
            result,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error executing Wolfram computation:', error);
      
      if (callback) {
        await callback({
          text: `Failed to compute: ${error.message}`,
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
        content: { text: 'Calculate 15% of 250' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll calculate 15% of 250 for you.',
          actions: ['WOLFRAM_COMPUTE'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What is the square root of 2024?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me compute the square root of 2024.',
          actions: ['WOLFRAM_COMPUTE'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Calculate the derivative of x^3 + 2x^2 - 5x + 1' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll calculate the derivative of that polynomial.',
          actions: ['WOLFRAM_COMPUTE'],
        },
      } as ActionExample,
    ],
  ],
};
