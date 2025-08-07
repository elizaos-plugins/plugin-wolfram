import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  logger,
  ProviderResult,
} from '@elizaos/core';
import { WolframService, WOLFRAM_SERVICE_NAME } from '../service';

export const wolframKnowledgeProvider: Provider = {
  name: 'wolfram_knowledge',
  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    try {
      const service = runtime.getService(WOLFRAM_SERVICE_NAME) as unknown as WolframService;
      
      if (!service) {
        return { text: '', values: {}, data: {} };
      }

      // Check if the message contains knowledge-seeking queries
      const text = message.content.text?.toLowerCase() || '';
      const knowledgeKeywords = [
        'what is', 'what are', 'who is', 'who was', 'where is',
        'when was', 'when did', 'how does', 'how do', 'why is',
        'why does', 'define', 'explain', 'tell me about', 'facts about',
        'information about', 'history of', 'geography', 'science',
        'physics', 'chemistry', 'biology', 'astronomy', 'weather'
      ];
      
      const hasKnowledgeQuery = knowledgeKeywords.some(keyword => 
        text.includes(keyword)
      );
      
      if (!hasKnowledgeQuery) {
        return { text: '', values: {}, data: {} };
      }

      // Extract potential topics from the message
      const topics = extractTopics(text);
      
      if (topics.length === 0) {
        return { text: '', values: {}, data: {} };
      }

      // Provide knowledge context
      const context = [
        'Wolfram Alpha knowledge base is available for comprehensive information.',
        `Detected topics of interest: ${topics.join(', ')}`,
        '',
        'Available knowledge domains include:',
        '- Scientific facts and data',
        '- Historical information',
        '- Geographic data',
        '- Cultural information',
        '- Technical specifications',
        '- Current data and statistics',
      ];
      
      return {
        text: context.join('\n'),
        values: {
          hasKnowledgeQuery,
          topicsCount: topics.length,
        },
        data: {
          provider: 'wolfram_knowledge',
          topics,
        },
      };
    } catch (error) {
      logger.error('Error in Wolfram knowledge provider:', error);
      return { text: '', values: {}, data: {} };
    }
  },
};

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  
  // Common topic patterns
  const patterns = [
    /about ([a-zA-Z\s]+)/gi,
    /what is ([a-zA-Z\s]+)/gi,
    /who is ([a-zA-Z\s]+)/gi,
    /facts about ([a-zA-Z\s]+)/gi,
    /information on ([a-zA-Z\s]+)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const topic = match[1].trim();
        if (topic.length > 2 && topic.length < 50) {
          topics.push(topic);
        }
      }
    }
  }
  
  // Also check for proper nouns (capitalized words)
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (properNouns) {
    topics.push(...properNouns.filter(noun => noun.length > 2));
  }
  
  // Remove duplicates
  return [...new Set(topics)].slice(0, 3); // Limit to 3 topics
}
