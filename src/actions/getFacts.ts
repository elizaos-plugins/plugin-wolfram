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

const getFactsTemplate = `
You are helping the user get facts about a topic.

Recent conversation context:
{{recentMessages}}

The user wants facts about: "{{userInput}}"

Extract the topic or subject they want facts about.
Return ONLY the topic, nothing else.
Examples: "Mars", "Albert Einstein", "Python programming language", "Tokyo"
`;

export const wolframGetFactsAction: Action = {
  name: 'WOLFRAM_GET_FACTS',
  description: 'Get facts and information about any topic using Wolfram Alpha',
  
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

      // Generate the topic from the user's input
      state = state || await runtime.composeState(message);
      
      const factsPrompt = composePromptFromState({
        state,
        template: getFactsTemplate,
      });
      
      const topicResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: factsPrompt,
      });
      
      const topic = topicResult.trim();
      logger.log(`📚 Getting facts about: "${topic}"`);
      
      // Get facts
      const facts = await service.getFacts(topic);
      
      // Format the facts
      let formattedFacts = `**Facts about ${topic}:**\n\n`;
      facts.forEach((fact, index) => {
        formattedFacts += `${index + 1}. ${fact}\n`;
      });
      
      if (callback) {
        await callback({
          text: formattedFacts,
          metadata: {
            topic,
            facts,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error getting facts:', error);
      
      if (callback) {
        await callback({
          text: `Failed to get facts: ${error.message}`,
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
        content: { text: 'Tell me facts about Jupiter' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll get you facts about Jupiter.',
          actions: ['WOLFRAM_GET_FACTS'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What are some facts about Albert Einstein?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me find facts about Albert Einstein.',
          actions: ['WOLFRAM_GET_FACTS'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Give me information about the Eiffel Tower' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll gather facts about the Eiffel Tower.',
          actions: ['WOLFRAM_GET_FACTS'],
        },
      } as ActionExample,
    ],
  ],
};
