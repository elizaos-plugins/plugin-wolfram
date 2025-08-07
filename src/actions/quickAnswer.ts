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

const quickAnswerTemplate = `
You are helping the user get a quick answer to a question.

Recent conversation context:
{{recentMessages}}

The user asks: "{{userInput}}"

Extract the question or query that needs a quick answer.
Return ONLY the question, nothing else.
Examples: "What is 2+2?", "Capital of France?", "Distance from Earth to Moon"
`;

export const wolframQuickAnswerAction: Action = {
  name: 'WOLFRAM_QUICK_ANSWER',
  description: 'Get quick, concise answers to simple questions using Wolfram Alpha',
  
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

      // Generate the question from the user's input
      state = state || await runtime.composeState(message);
      
      const questionPrompt = composePromptFromState({
        state,
        template: quickAnswerTemplate,
      });
      
      const questionResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: questionPrompt,
      });
      
      const question = questionResult.trim();
      logger.log(`⚡ Quick answer for: "${question}"`);
      
      // Try short answer first
      const shortAnswer = await service.getShortAnswer(question);
      
      if (shortAnswer.success && shortAnswer.answer) {
        if (callback) {
          await callback({
            text: `**Question:** ${question}\n**Answer:** ${shortAnswer.answer}`,
            metadata: {
              question,
              answer: shortAnswer.answer,
              type: 'short',
              source: 'Wolfram Alpha',
            },
          } as Content);
        }
        return true;
      }
      
      // Fallback to spoken answer
      const spokenAnswer = await service.getSpokenAnswer(question);
      
      if (spokenAnswer.success && spokenAnswer.spoken) {
        if (callback) {
          await callback({
            text: `**Question:** ${question}\n**Answer:** ${spokenAnswer.spoken}`,
            metadata: {
              question,
              answer: spokenAnswer.spoken,
              type: 'spoken',
              source: 'Wolfram Alpha',
            },
          } as Content);
        }
        return true;
      }
      
      // Final fallback
      if (callback) {
        await callback({
          text: `I couldn't find a quick answer to: ${question}. Try using a more detailed query.`,
          metadata: {
            question,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error getting quick answer:', error);
      
      if (callback) {
        await callback({
          text: `Failed to get quick answer: ${error instanceof Error ? error.message : String(error)}`,
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
        content: { text: 'What is the speed of light?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll get you a quick answer.',
          actions: ['WOLFRAM_QUICK_ANSWER'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'How many days in a leap year?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me find that quick answer for you.',
          actions: ['WOLFRAM_QUICK_ANSWER'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What\'s the boiling point of water in Celsius?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll get that information quickly.',
          actions: ['WOLFRAM_QUICK_ANSWER'],
        },
      } as ActionExample,
    ],
  ],
};
