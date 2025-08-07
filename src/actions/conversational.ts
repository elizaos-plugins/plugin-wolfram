import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  Content,
  logger,
  ActionExample,
} from '@elizaos/core';
import { WolframService, WOLFRAM_SERVICE_NAME } from '../service';

export const wolframConversationalAction: Action = {
  name: 'WOLFRAM_CONVERSATIONAL',
  description: 'Have a conversational interaction with Wolfram Alpha that maintains context across queries',
  
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const service = runtime.getService(WOLFRAM_SERVICE_NAME);
    return service instanceof WolframService;
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
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

      const userInput = message.content.text;
      const userId = message.userId;
      
      logger.log(`💬 Conversational query from ${userId}: "${userInput}"`);
      
      // Execute conversational query
      const result = await service.conversationalQuery(userInput, userId);
      
      if (result.error) {
        if (callback) {
          await callback({
            text: `Error: ${result.error}`,
            error: true,
          } as Content);
        }
        return false;
      }
      
      if (result.expired) {
        // Clear the conversation and retry
        service.clearConversation(userId);
        const retryResult = await service.conversationalQuery(userInput, userId);
        
        if (callback) {
          await callback({
            text: retryResult.result || retryResult.s || 'No response available.',
            metadata: {
              conversationID: retryResult.conversationID,
              newConversation: true,
              source: 'Wolfram Alpha Conversational',
            },
          } as Content);
        }
      } else {
        if (callback) {
          await callback({
            text: result.result || result.s || 'No response available.',
            metadata: {
              conversationID: result.conversationID,
              source: 'Wolfram Alpha Conversational',
            },
          } as Content);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error in conversational query:', error);
      
      if (callback) {
        await callback({
          text: `Failed to process conversational query: ${error.message}`,
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
        content: { text: 'Let\'s talk about prime numbers' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll start a conversation about prime numbers with Wolfram Alpha.',
          actions: ['WOLFRAM_CONVERSATIONAL'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What are the first 10?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Continuing our conversation about prime numbers...',
          actions: ['WOLFRAM_CONVERSATIONAL'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Which one is the largest below 100?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me find that in the context of our prime numbers discussion.',
          actions: ['WOLFRAM_CONVERSATIONAL'],
        },
      } as ActionExample,
    ],
  ],
};
