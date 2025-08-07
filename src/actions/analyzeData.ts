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

const analyzeDataTemplate = `
You are helping the user analyze data.

Recent conversation context:
{{recentMessages}}

The user wants to analyze: "{{userInput}}"

Extract the data or dataset that needs to be analyzed. This could be:
- A list of numbers (e.g., "1, 2, 3, 4, 5")
- A data description (e.g., "heights: 170cm, 165cm, 180cm, 175cm")
- A statistical query (e.g., "mean of 10, 20, 30, 40")

Return ONLY the data or analysis request, nothing else.
`;

export const wolframAnalyzeDataAction: Action = {
  name: 'WOLFRAM_ANALYZE_DATA',
  description: 'Analyze data and get statistical insights using Wolfram Alpha',
  
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

      // Generate the data from the user's input
      state = state || await runtime.composeState(message);
      
      const dataPrompt = composePromptFromState({
        state,
        template: analyzeDataTemplate,
      });
      
      const dataResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: dataPrompt,
      });
      
      const data = dataResult.trim();
      logger.log(`📊 Analyzing data: "${data.substring(0, 50)}..."`);
      
      // Analyze the data
      const analysis = await service.analyzeData(data);
      
      // Format the analysis
      let formattedAnalysis = `**Data Analysis:**\n\n`;
      
      if (analysis.error) {
        formattedAnalysis = analysis.error;
      } else {
        for (const [key, value] of Object.entries(analysis)) {
          formattedAnalysis += `**${key}:**\n${value}\n\n`;
        }
      }
      
      if (callback) {
        await callback({
          text: formattedAnalysis.trim(),
          metadata: {
            data: data.substring(0, 100),
            analysis,
            source: 'Wolfram Alpha',
          },
        } as Content);
      }
      
      return true;
    } catch (error) {
      logger.error('Error analyzing data:', error);
      
      if (callback) {
        await callback({
          text: `Failed to analyze data: ${error instanceof Error ? error.message : String(error)}`,
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
        content: { text: 'Analyze this data: 12, 15, 18, 22, 25, 28, 31' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll analyze this dataset for you.',
          actions: ['WOLFRAM_ANALYZE_DATA'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'What\'s the standard deviation of 100, 105, 110, 115, 120?' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'Let me calculate the statistical analysis for this data.',
          actions: ['WOLFRAM_ANALYZE_DATA'],
        },
      } as ActionExample,
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Find the correlation between (1,2), (2,4), (3,6), (4,8)' },
      } as ActionExample,
      {
        name: '{{agent}}',
        content: { 
          text: 'I\'ll analyze the correlation in this dataset.',
          actions: ['WOLFRAM_ANALYZE_DATA'],
        },
      } as ActionExample,
    ],
  ],
};
