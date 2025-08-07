import {
  Plugin,
  IAgentRuntime,
  logger,
} from '@elizaos/core';

// Import service
import { WolframService, WOLFRAM_SERVICE_NAME } from './service';

// Import actions
import { wolframQueryAction } from './actions/query';
import { wolframComputeAction } from './actions/compute';
import { wolframSolveAction } from './actions/solve';
import { wolframStepByStepAction } from './actions/stepByStep';
import { wolframGetFactsAction } from './actions/getFacts';
import { wolframAnalyzeDataAction } from './actions/analyzeData';
import { wolframConversationalAction } from './actions/conversational';
import { wolframQuickAnswerAction } from './actions/quickAnswer';

// Import providers
import { wolframComputationProvider } from './providers/computationProvider';
import { wolframKnowledgeProvider } from './providers/knowledgeProvider';

// Import environment validation
import { isWolframConfigured } from './environment';

// Export all components for external use
export * from './types';
export * from './environment';
export { WolframService, WOLFRAM_SERVICE_NAME } from './service';

export const wolframPlugin: Plugin = {
  name: 'wolfram',
  description: 'Wolfram Alpha and Wolfram Cloud integration for mathematical computations, data analysis, and knowledge queries',
  
  actions: [
    wolframQueryAction,
    wolframComputeAction,
    wolframSolveAction,
    wolframStepByStepAction,
    wolframGetFactsAction,
    wolframAnalyzeDataAction,
    wolframConversationalAction,
    wolframQuickAnswerAction,
  ],
  
  providers: [
    wolframComputationProvider,
    wolframKnowledgeProvider,
  ],
  
  services: [
    WolframService,
  ],
  
  evaluators: [],
  
  /**
   * Initialize the Wolfram plugin
   */
  async init(config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    logger.log('🐺 Initializing Wolfram plugin...');
    
    // Check if Wolfram is configured
    if (!isWolframConfigured(runtime)) {
      logger.warn('⚠️ Wolfram plugin is not configured. Please set WOLFRAM_APP_ID in your environment.');
      logger.warn('Get your App ID from: https://products.wolframalpha.com/api/');
      return;
    }
    
    try {
      // Initialize the service
      const service = runtime.getService(WOLFRAM_SERVICE_NAME) as unknown as WolframService;
      if (service) {
        await service.initialize();
        logger.log('✅ Wolfram plugin initialized successfully');
      }
    } catch (error) {
      logger.error('❌ Failed to initialize Wolfram plugin:', error);
      throw error;
    }
  },
  
  // No plugin dependencies required
};

// Default export for easier importing
export default wolframPlugin;
