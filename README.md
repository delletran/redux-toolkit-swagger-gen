# Redux Toolkit Swagger Generator

Generate Redux Toolkit API clients from Swagger/OpenAPI specifications.

## Features

- Generates TypeScript types from Swagger/OpenAPI schemas
- Creates Redux Toolkit slices and API services
- Generates API client with full TypeScript support
- Supports both local and remote Swagger files
- Built-in prettier formatting
- Customizable output structure

## Installation

```bash
# Local installation (recommended)
npm install redux-toolkit-swagger-gen --save-dev

# Global installation
npm install -g redux-toolkit-swagger-gen

# Or use directly with npx
npx redux-toolkit-swagger-gen
```

## Usage

### Command Line

```bash
# Using locally installed version
npx swagger-gen --url http://your-api/swagger.json

# Using global installation
swagger-gen --url http://your-api/swagger.json

# Local swagger file
swagger-gen --url ./swagger.json --output ./src/api

# With all options
swagger-gen \
  --url http://your-api/swagger.json \
  --output src/api \
  --clean \
  --verbose \
  --prettier
```

### NPM Script (Recommended)

Add to your package.json:
```json
{
  "scripts": {
    "generate-api": "swagger-gen --url ./swagger.json",
    "generate-api:watch": "nodemon --watch ./swagger.json --exec 'npm run generate-api'"
  }
}
```

Then run:
```bash
npm run generate-api
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

## Project Structure
```
src/
├── templates/        # Template files
├── redux/       # Redux related templates
│   ├── redux.d.ts
│   ├── types.ts
│   └── helper/
├── schema/      # Schema templates
├── generators/      # Code generators
├── utils/          # Utility functions
└── generate.ts     # Main entry point
```

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/redux-toolkit-swagger-gen.git
cd redux-toolkit-swagger-gen

# Install dependencies
npm install

# Create template directories
mkdir -p src/templates/{redux,schema}
mkdir -p src/templates/redux/helper

# Build the project
npm run build

# Create symlink for local development
npm link

# Test the CLI
swagger-gen --help
```

## Template Files
The following template files are required:

### Redux Templates
- `src/templates/redux/redux.d.ts` - Redux type definitions
- `src/templates/redux/types.ts` - Common type definitions
- `src/templates/redux/query.ts` - Query utilities
- `src/templates/redux/actions.ts` - Action creators
- `src/templates/redux/helper/array.ts` - Array utilities

### Schema Templates
- `src/templates/schema/api.ts` - API schema definitions

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

## Usage Examples

### Store Setup

```typescript
// store.ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { user } from './api/services/user/user';
import userReducer from './api/thunks/user/user.thunk';

export const store = configureStore({
  reducer: {
    // RTK Query service
    [user.reducerPath]: user.reducer,
    // Redux Thunk
    userThunk: userReducer,
  },
  middleware: (getDefault) => 
    getDefault().concat(user.middleware),
});

// Enable refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);
```

### Using RTK Query Services

```typescript
// UserList.tsx
import { useGetUserListQuery } from './api/services/user/user';

function UserList() {
  const { data, error, isLoading } = useGetUserListQuery({
    page: 1,
    page_size: 10
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;

  return (
    <ul>
      {data?.results.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// UserForm.tsx
import { usePutUserUpdateMutation } from './api/services/user/user';

function UserForm({ userId }) {
  const [updateUser, { isLoading }] = usePutUserUpdateMutation();

  const handleSubmit = async (data) => {
    try {
      await updateUser({ id: userId, data }).unwrap();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };
}
```

### Using Redux Thunks

```typescript
// UserListThunk.tsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getUserList } from './api/thunks/user/user.thunk';

function UserListThunk() {
  const dispatch = useDispatch();
  const { entities, loading, error } = useSelector((state) => state.userThunk);

  useEffect(() => {
    dispatch(getUserList({ page: 1, page_size: 10 }));
  }, [dispatch]);

  if (loading === 'pending') return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <ul>
      {entities.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// UserFormThunk.tsx
import { putUserUpdate } from './api/thunks/user/user.thunk';

function UserFormThunk({ userId }) {
  const dispatch = useDispatch();

  const handleSubmit = async (data) => {
    try {
      await dispatch(putUserUpdate({ id: userId, data })).unwrap();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };
}
```

### Choosing Between Services and Thunks

- **RTK Query Services**: Best for data fetching with automatic caching, polling, and cache invalidation
- **Redux Thunks**: Better for complex state management and side effects

## Requirements

- Node.js 14+
- React 16.8+
- @reduxjs/toolkit 2.0+

## Troubleshooting

### Command Not Found
If you get "command not found", try:
1. Use `npx swagger-gen` instead
2. Check if package is installed (`npm list redux-toolkit-swagger-gen`)
3. Try reinstalling the package

### CORS Issues
When fetching remote swagger files:
1. Use a local swagger file instead
2. Add CORS headers to your API server
3. Use a proxy server
4. Download the swagger file first then use local path

### Permission Errors
On Unix systems, you might need to:
```bash
chmod +x node_modules/.bin/swagger-gen
```

### Watch Mode
For development, use nodemon:
```bash
npm install nodemon --save-dev
nodemon --watch swagger.json --exec "swagger-gen --url ./swagger.json"
```

## Publishing

```bash
# Update version
npm version patch

# Build and publish
npm run build
npm publish
```

## Contributing

PRs welcome! Please read our contributing guidelines first.

## License

MIT
