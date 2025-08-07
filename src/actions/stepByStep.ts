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

const stepByStepTemplate = `
You are helping the user get a step-by-step solution to a problem.

Recent conversation context:
{{recentMessages}}

The user wants step-by-step solution for: "{{userInput}}"

Extract the problem that needs step-by-step solution.
Return ONLY the problem statement, nothing else.
Examples: "integrate x^2 dx", "solve x^2 - 5x + 6 = 0", "factor x^3 - 8"
`;

export const wolframStepByStepAction: Action = {
  name: 'WOLFRAM_STEP_BY_STEP',
  description: 'Get step-by-step solutions for mathematical problems using Wolfram Alpha',
  
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

      // Generate the problem from the user's input
      state = state || await runtime.composeState(message);
      
      const stepPrompt = composePromptFromState({
        state,
        template: stepByStepTemplate,
      });
      
      const problemResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: stepPrompt,
      });
      
      const problem = problemResult.trim();
      logger.log(`📋 Getting step-by-step solution for: "${problem}"`);
      
      // Get step-by-step solution
      const steps = await service.getStepByStep(problem);
      
      // Format the steps
      let formattedSteps = `**Problem:** ${problem}\n\n**Step-by-Step Solution:**\n`;
      steps.forEach((step, index) => {
        formattedSteps += `\n**Step ${index + 1}:**\n${step}\n`;
      });
      
      if (callback) {
        await callback({
          text: formattedSteps,
          metadata: {
            problem,
            steps,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error getting step-by-step solution:', error);
      
      if (callback) {
        await callback({
          text: `Failed to get step-by-step solution: ${error instanceof Error ? error.message : String(error)}`,
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
        content: { text: 'Show me how to solve x^2 - 6x + 8 = 0 step by step' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll show you the step-by-step solution for this quadratic equation.',
          actions: ['WOLFRAM_STEP_BY_STEP'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'How do I integrate x * sin(x) dx?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me show you the step-by-step integration process.',
          actions: ['WOLFRAM_STEP_BY_STEP'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Walk me through factoring x^3 - 27' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll provide step-by-step factorization.',
          actions: ['WOLFRAM_STEP_BY_STEP'],
        },
      } as ActionExample,
    ],
  ],
};
