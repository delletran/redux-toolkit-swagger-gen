# Contributing to Redux Toolkit Swagger Generator

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/redux-toolkit-swagger-gen.git
cd redux-toolkit-swagger-gen

# Install dependencies
npm install

# Build the project
npm run build

# Create symlink for local testing
npm link
```

## Project Structure

```
src/
├── templates/        # Template files
├── generators/      # Code generators
├── utils/          # Utility functions
└── generate.ts     # Main entry point
```

## Required Template Files

### Redux Templates
- `src/redux/redux.d.ts` - Type definitions
- `src/redux/types.ts` - Common types
- `src/redux/query.ts` - Query utilities
- `src/redux/actions.ts` - Action creators
- `src/redux/helper/array.ts` - Array utilities

### Schema Templates
- `src/schema/api.ts` - API schema definitions

## Development Workflow

1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR

## Publishing

```bash
# Update version
npm version patch

# Build and publish
npm run build
npm publish
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Documentation

Update both:
- README.md for user documentation
- CONTRIBUTING.md for development guide
