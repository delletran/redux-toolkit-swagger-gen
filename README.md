# Redux Toolkit Swagger Generator

Generate Redux Toolkit API clients from Swagger/OpenAPI specifications automatically.

## Features

- Generates TypeScript types from Swagger/OpenAPI schemas
- Creates Redux Toolkit slices and API services
- Generates API client with full TypeScript support
- Supports both local and remote Swagger files
- Built-in prettier formatting
- Customizable output structure

## Installation

```bash
# Using npm
npm install redux-toolkit-swagger-gen --save-dev

# Using yarn
yarn add -D redux-toolkit-swagger-gen

# Global installation
npm install -g redux-toolkit-swagger-gen
```

## Quick Start

```bash
# Basic usage
npx swagger-gen --url http://your-api/swagger.json

# With all options
npx swagger-gen --url http://your-api/swagger.json \
                --output src/api \
                --clean \
                --verbose \
                --prettier
```

## CLI Options

| Option           | Alias | Description                           | Default                           |
|-----------------|-------|---------------------------------------|-----------------------------------|
| --url           | -u    | Swagger JSON URL or file path         | http://localhost:8000/swagger.json |
| --output        | -o    | Output directory                      | src/api                          |
| --verbose       | -v    | Show detailed logs                    | false                            |
| --clean         | -c    | Clean output directory before gen     | false                            |
| --skipValidation| -s    | Skip swagger schema validation        | false                            |
| --prettier      | -p    | Format generated code with prettier   | true                             |
| --help          | -h    | Show help                            | -                                |

## Package.json Configuration

Add to your package.json:

```json
{
  "scripts": {
    "generate-api": "swagger-gen --url ./swagger.json --output src/api --clean --verbose"
  }
}
```

## Output Structure

```
src/api/
├── constants/      # API constants and enums
├── redux/         # Redux toolkit setup
│   └── helper/    # Redux utilities
├── schema/        # API schemas and types
├── services/      # API service definitions
└── thunks/        # Redux thunks
```

## Usage Example

```typescript
// In your Redux store setup
import { configureStore } from '@reduxjs/toolkit';
import { userSlice } from './api/redux/slices/user.slice';

export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
});

// In your components
import { useGetUserQuery } from './api/services/user';

function UserComponent() {
  const { data, isLoading } = useGetUserQuery();
  return isLoading ? <div>Loading...</div> : <div>{data.name}</div>;
}
```

## Requirements

- Node.js 14+
- React 16.8+
- @reduxjs/toolkit 2.0+

## Troubleshooting

### CORS Issues
When fetching remote swagger files, you might encounter CORS issues. Solutions:
1. Use a local swagger file
2. Configure your API server to allow CORS
3. Use a proxy server

### Type Generation Fails
Check that your swagger file is valid using a [Swagger Validator](https://validator.swagger.io/)

## Contributing

PRs welcome! Please read our contributing guidelines first.

## License

MIT
