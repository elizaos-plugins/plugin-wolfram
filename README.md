# @elizaos/plugin-wolfram

A comprehensive Wolfram Alpha and Wolfram Cloud integration plugin for ElizaOS, enabling advanced mathematical computations, data analysis, and knowledge queries.

## Features

- **Mathematical Computations**: Solve equations, calculate integrals, derivatives, and more
- **Step-by-Step Solutions**: Get detailed solution steps for mathematical problems
- **Data Analysis**: Analyze datasets with statistical computations
- **Knowledge Queries**: Access vast knowledge base for facts about any topic
- **Conversational API**: Maintain context across multiple queries
- **Quick Answers**: Get concise answers to simple questions
- **Multiple Output Formats**: Support for plaintext, images, MathML, and more
- **Intelligent Caching**: Reduce API calls with smart result caching
- **Location-Aware**: Provide location-based results for relevant queries

## Installation

```bash
npm install @elizaos/plugin-wolfram
# or
yarn add @elizaos/plugin-wolfram
# or
bun add @elizaos/plugin-wolfram
```

## Configuration

### Required Environment Variables

```bash
# Wolfram Alpha App ID (Required)
WOLFRAM_APP_ID=your_app_id_here
# or
WOLFRAM_ALPHA_APP_ID=your_app_id_here
```

### Optional Environment Variables

```bash
# Wolfram Cloud API Key for advanced features
WOLFRAM_CLOUD_API_KEY=your_cloud_api_key

# Custom API endpoint (default: https://api.wolframalpha.com/v2)
WOLFRAM_API_ENDPOINT=https://api.wolframalpha.com/v2

# Output format: plaintext, image, mathml, sound, wav (default: plaintext)
WOLFRAM_OUTPUT_FORMAT=plaintext

# Request timeout in milliseconds (default: 10000, min: 1000, max: 30000)
WOLFRAM_TIMEOUT=10000

# Units preference: metric or imperial (default: metric)
WOLFRAM_UNITS=metric

# Location for location-based queries (e.g., "New York, NY")
WOLFRAM_LOCATION=New York, NY

# Comma-separated list of scanner types to use
WOLFRAM_SCANNERS=Solve,Data,Statistics

# Maximum number of results per query (default: 5, min: 1, max: 10)
WOLFRAM_MAX_RESULTS=5
```

### Getting Your Wolfram Alpha App ID

1. Visit [Wolfram Alpha Products](https://products.wolframalpha.com/api/)
2. Sign up for a free or paid account
3. Create a new app to get your App ID
4. Add the App ID to your `.env` file

## Usage

### Basic Setup

```typescript
import { wolframPlugin } from '@elizaos/plugin-wolfram';

const character = {
  name: "MathBot",
  plugins: [wolframPlugin],
  // ... other configuration
};
```

### Available Actions

The plugin provides several specialized actions for different use cases:

#### 1. **WOLFRAM_QUERY** - General Queries
Query Wolfram Alpha for comprehensive information about any topic.

**Examples:**
- "What is the population of Tokyo?"
- "Tell me about black holes"
- "What's the weather in Paris?"

#### 2. **WOLFRAM_COMPUTE** - Mathematical Calculations
Perform mathematical calculations and computations.

**Examples:**
- "Calculate 15% of 250"
- "What is the square root of 2024?"
- "Compute the factorial of 12"

#### 3. **WOLFRAM_SOLVE** - Equation Solving
Solve mathematical equations and systems of equations.

**Examples:**
- "Solve x^2 - 4x + 3 = 0"
- "Find x if 3x + 7 = 22"
- "Solve the system: x + y = 10 and x - y = 2"

#### 4. **WOLFRAM_STEP_BY_STEP** - Detailed Solutions
Get step-by-step solutions for mathematical problems.

**Examples:**
- "Show me how to solve x^2 - 6x + 8 = 0 step by step"
- "How do I integrate x * sin(x) dx?"
- "Walk me through factoring x^3 - 27"

#### 5. **WOLFRAM_GET_FACTS** - Information Retrieval
Get facts and information about any topic.

**Examples:**
- "Tell me facts about Jupiter"
- "What are some facts about Albert Einstein?"
- "Give me information about the Eiffel Tower"

#### 6. **WOLFRAM_ANALYZE_DATA** - Statistical Analysis
Analyze data and get statistical insights.

**Examples:**
- "Analyze this data: 12, 15, 18, 22, 25, 28, 31"
- "What's the standard deviation of 100, 105, 110, 115, 120?"
- "Find the correlation between (1,2), (2,4), (3,6), (4,8)"

#### 7. **WOLFRAM_CONVERSATIONAL** - Context-Aware Queries
Have conversational interactions that maintain context across queries.

**Examples:**
- First: "Let's talk about prime numbers"
- Then: "What are the first 10?"
- Then: "Which one is the largest below 100?"

#### 8. **WOLFRAM_QUICK_ANSWER** - Concise Responses
Get quick, concise answers to simple questions.

**Examples:**
- "What is the speed of light?"
- "How many days in a leap year?"
- "What's the boiling point of water in Celsius?"

### Providers

The plugin includes intelligent providers that automatically detect when Wolfram capabilities might be useful:

#### 1. **Computation Provider**
Detects mathematical expressions and computational queries in conversations.

#### 2. **Knowledge Provider**
Identifies knowledge-seeking queries and provides relevant context.

## API Integration

### Service Methods

The WolframService class provides direct access to Wolfram APIs:

```typescript
// Get the service instance
const wolframService = runtime.getService('wolfram') as WolframService;

// Query Wolfram Alpha
const result = await wolframService.query('integral of x^2');

// Get a simple answer
const answer = await wolframService.getShortAnswer('2 + 2');

// Solve an equation
const solution = await wolframService.solveMath('x^2 - 5x + 6 = 0');

// Get step-by-step solution
const steps = await wolframService.getStepByStep('derivative of x^3');

// Analyze data
const analysis = await wolframService.analyzeData('1,2,3,4,5,6,7,8,9,10');

// Get facts about a topic
const facts = await wolframService.getFacts('Mars');

// Conversational query (maintains context)
const conversation = await wolframService.conversationalQuery(
  'Tell me about the solar system',
  'user-123'
);

// Clear conversation context for a user
wolframService.clearConversation('user-123');

// Clear all caches
wolframService.clearCache();

// Get service statistics
const stats = wolframService.getStats();
```

### Response Formatting

The service automatically formats responses for display:

```typescript
const result = await wolframService.query('weather in London');
const formatted = wolframService.formatResult(result);
// Returns formatted text with pods, assumptions, and warnings
```

## Advanced Features

### Caching

The plugin implements intelligent caching to reduce API calls:
- Results are cached for 1 hour by default
- Cache is automatically cleaned of expired entries
- Conversation context is maintained per user
- Manual cache clearing available

### Error Handling

The plugin provides comprehensive error handling:
- Invalid API key detection
- Timeout handling
- Rate limit management
- Graceful fallbacks for failed queries

### Location-Based Queries

When `WOLFRAM_LOCATION` is set, queries automatically use location context:
- Weather queries
- Timezone calculations
- Local business information
- Geographic calculations

### Custom Scanners

Use specific Wolfram scanners for optimized results:
- `Solve` - For equation solving
- `Data` - For data analysis
- `Statistics` - For statistical computations
- `Weather` - For weather information

## Development

### Building

```bash
npm run build
# or
yarn build
# or
bun run build
```

### Testing

```bash
npm test
# or
yarn test
# or
bun test
```

### Development Mode

```bash
npm run dev
# or
yarn dev
# or
bun run dev
```

## Examples

### Basic Math Agent

```typescript
import { wolframPlugin } from '@elizaos/plugin-wolfram';

const mathAgent = {
  name: "MathTutor",
  description: "A helpful math tutor powered by Wolfram Alpha",
  plugins: [wolframPlugin],
  settings: {
    WOLFRAM_APP_ID: process.env.WOLFRAM_APP_ID,
    WOLFRAM_UNITS: 'metric',
  },
};
```

### Science Knowledge Agent

```typescript
const scienceAgent = {
  name: "ScienceExpert",
  description: "A knowledgeable science assistant",
  plugins: [wolframPlugin],
  settings: {
    WOLFRAM_APP_ID: process.env.WOLFRAM_APP_ID,
    WOLFRAM_SCANNERS: 'Data,Statistics,Weather',
    WOLFRAM_MAX_RESULTS: 10,
  },
};
```

### Data Analysis Agent

```typescript
const dataAnalyst = {
  name: "DataAnalyst",
  description: "Statistical analysis and data insights",
  plugins: [wolframPlugin],
  settings: {
    WOLFRAM_APP_ID: process.env.WOLFRAM_APP_ID,
    WOLFRAM_SCANNERS: 'Statistics,Data',
    WOLFRAM_OUTPUT_FORMAT: 'plaintext',
  },
};
```

## API Limits

Be aware of Wolfram Alpha API limits:
- Free tier: 2,000 calls per month
- Rate limits apply based on your subscription
- Consider implementing additional caching for high-traffic applications

## Troubleshooting

### Common Issues

1. **"Invalid or missing Wolfram Alpha App ID"**
   - Ensure `WOLFRAM_APP_ID` is set in your environment
   - Verify the App ID is correct and active

2. **Timeout errors**
   - Increase `WOLFRAM_TIMEOUT` value
   - Check your internet connection
   - Complex queries may take longer

3. **No results returned**
   - Try rephrasing the query
   - Check if the topic is within Wolfram's knowledge base
   - Verify scanner settings are appropriate

4. **Rate limit exceeded**
   - Implement additional caching
   - Upgrade your Wolfram Alpha subscription
   - Reduce query frequency

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

## License

MIT License - see LICENSE file for details

## Support

- [Wolfram Alpha Documentation](https://products.wolframalpha.com/api/documentation/)
- [ElizaOS Documentation](https://github.com/elizaos/eliza)
- [Report Issues](https://github.com/elizaos/eliza/issues)

## Credits

This plugin is part of the ElizaOS ecosystem, built by the elizaOS community.