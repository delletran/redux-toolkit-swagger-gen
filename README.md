# Redux Toolkit Swagger Generator

Generate Redux Toolkit API clients from Swagger/OpenAPI specifications.

## Features

- Generates TypeScript types from Swagger/OpenAPI schemas
- Creates Redux Toolkit slices and API services
- Generates API client with full TypeScript support
- Supports both local and remote Swagger files
- **Supports OpenAPI 3.1.0 format**
- **Generates Redux hooks and store with persistence**
- Built-in prettier formatting
- Customizable output structure

## Installation

```bash
npm install redux-toolkit-swagger-gen --save-dev
```

## Quick Start

```bash
# Generate API client
swagger-gen --url http://your-api/swagger.json --output src/api
swagger-gen --url http://localhost:8000/openapi.json --output src/api
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

## Generated Structure

```
src/api/
├── constants/      # API constants and enums
├── redux/         # Redux toolkit setup and hooks
│   ├── hooks.ts   # TypeScript hooks for Redux state & dispatch
│   └── store.ts   # Pre-configured Redux store with services
├── schema/        # API schemas and types
├── services/      # API service definitions
├── slices/        # Redux slices for state management
└── thunks/        # Redux thunks
```

## Usage Examples

### Store Setup

```typescript
// Use the pre-generated store
import { store, persistor } from './api/redux/store';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <YourApp />
      </PersistGate>
    </Provider>
  );
}

// Or customize the store
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { userApi } from './api/services/user';
import userThunks from './api/thunks/user';

export const store = configureStore({
  reducer: {
    // RTK Query service
    [userApi.reducerPath]: userApi.reducer,
    // Redux Thunk
    user: userThunks,
  },
  middleware: (getDefault) => 
    getDefault().concat(userApi.middleware),
});

setupListeners(store.dispatch);
```

### Using Generated Hooks and Services

```typescript
// RTK Query hooks
import { useGetUserListQuery, usePutUserUpdateMutation } from './api/services/user';

// Use the generated hooks
import { useAppDispatch, useAppSelector } from './api/redux/hooks';

// Redux Thunks
import { getUserList, putUserUpdate } from './api/thunks/user';

// RTK Query Example
function UserList() {
  const { data, isLoading } = useGetUserListQuery({ page: 1 });
  return isLoading ? <div>Loading...</div> : <div>{data.results.length}</div>;
}

// Thunk Example with TypedHooks
function UserListThunk() {
  const dispatch = useAppDispatch();
  const userData = useAppSelector(state => state.user.data);
  
  useEffect(() => {
    dispatch(getUserList({ page: 1 }));
  }, [dispatch]);
  
  return <div>{userData?.length || 0} users</div>;
}
```

## Troubleshooting

### CORS Issues
1. Use a local swagger file
2. Configure API server CORS
3. Use a proxy server

### Command Not Found
1. Use `npx swagger-gen`
2. Check installation: `npm list redux-toolkit-swagger-gen`
3. Reinstall package

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT
