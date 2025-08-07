# Changelog

## [0.1.1] - 2025-01-XX

### Fixed
- Fixed TypeScript import errors by replacing non-existent `composeContext` with `composePromptFromState`
- Fixed text generation by using `runtime.useModel()` instead of non-existent `generateText` function
- Fixed action example structure to use `name` instead of `user` field
- Fixed action example structure to use `actions` array instead of single `action` field
- Fixed service type casting issues with proper type assertions
- Fixed error handling for unknown error types in catch blocks
- Fixed all TypeScript linting errors
- Fixed property name conflict by renaming `config` to `wolframConfig` to avoid base class override

### Changed
- Updated all action imports to use correct ElizaOS core exports
- Updated all action handlers to use proper text generation patterns
- Updated all action examples to conform to ActionExample interface

## [0.1.0] - 2025-01-XX

### Added
- Initial release of Wolfram Alpha plugin for ElizaOS
- 8 specialized actions for different query types
- 2 intelligent providers for context detection
- Comprehensive Wolfram Alpha API integration
- Smart caching system with 1-hour TTL
- Conversational context management
- Full TypeScript support with detailed type definitions
- Unit and integration tests
- Comprehensive documentation
