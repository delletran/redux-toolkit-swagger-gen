# redux-toolkit-swagger-gen — OpenAPI → RTK Query Code Generator

In-house TypeScript CLI tool that reads a FastAPI OpenAPI 3.1 spec and generates a complete, type-safe RTK Query API client layer for both GMS and 247FitHome frontends.

**Version:** 0.1.13  
**Author:** Rodel Letran  
**Consumed by:** React application

## Purpose

Instead of hand-writing RTK Query service files for every one of the ~80 FastAPI endpoints, this generator reads the live OpenAPI spec and produces a complete, type-safe API layer automatically. Any backend Pydantic schema change automatically surfaces as TypeScript/Zod type errors in the frontend after running the generator.

## What Gets Generated

```
src/api/
├── constants/           ← TypeScript enums from OpenAPI enum schemas
├── models/              ← Zod schemas + inferred TypeScript types (one per OpenAPI component)
├── services/            ← RTK Query createApi services (one per OpenAPI tag)
├── slices/              ← Redux state slices
├── thunks/              ← Redux async thunks
└── redux/
    ├── store.ts         ← Pre-configured Redux store with all service reducers
    └── hooks.ts         ← Typed useAppDispatch / useAppSelector
```

**Rule:** Never manually edit anything under `src/api/` in either frontend. Run the generator instead.

## CLI Usage

```bash
# From gms/ or 247FitHome/ (uses npm run generate-api which calls this):
node generate-api.js \
  --url http://localhost:8200/api/openapi.json \
  --output src/api \
  --api-base-path api/v1 \
  --reduxPath src/store/redux \
  --use@ \
  --exclude hooks \
  --skipAuthSlice \
  --clean
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--url` | URL of the OpenAPI JSON spec (live gms_service) |
| `--output` | Output directory for generated files |
| `--api-base-path` | API prefix to strip from path names |
| `--reduxPath` | Where to output `store.ts` and `hooks.ts` |
| `--use@` | Generate imports using `@/` path aliases |
| `--exclude hooks` | Skip generating RTK Query hook wrappers (use built-in hooks instead) |
| `--skipAuthSlice` | Preserve hand-written auth slice instead of generating one |
| `--clean` | Delete and recreate the output directory |

## How It Works

1. **Fetch spec** — Downloads `openapi.json` from the running gms_service
2. **Dereference** — Uses `@apidevtools/json-schema-ref-parser` to inline all `$ref` pointers
3. **Parse schemas** — Converts OpenAPI component schemas to Zod validators + TypeScript types
4. **Parse paths** — Groups endpoints by OpenAPI `tags` (one service file per tag)
5. **Render templates** — Uses Mustache templates to generate TypeScript files
6. **Format** — Runs Prettier on all output files

## Dependencies

```json
{
  "@apidevtools/json-schema-ref-parser": "^11.x",
  "mustache": "^4.x",
  "prettier": "^3.x",
  "yargs": "^17.x"
}
```

## Project Structure

```
lib/redux-toolkit-swagger-gen/
├── package.json
├── index.js          ← CLI entry point
├── src/
│   ├── generator.js  ← Main generation orchestrator
│   ├── parser.js     ← OpenAPI spec parser
│   ├── templates/    ← Mustache templates for each output type
│   │   ├── service.mustache
│   │   ├── model.mustache
│   │   ├── slice.mustache
│   │   └── store.mustache
│   └── utils/        ← Naming conventions, type mapping utilities
└── README.md
```

## Local Development

The library is consumed as a local file dependency:
```json
// gms/package.json + 247FitHome/package.json
"redux-toolkit-swagger-gen": "file:../lib/redux-toolkit-swagger-gen"
```

To make changes to the generator and test them:

```bash
# Edit the generator
cd lib/redux-toolkit-swagger-gen

# Re-link in consuming project
cd ../../gms && npm install

# Test generation
npm run generate-api
```

## Generated Service Pattern

Each generated service looks like:

```typescript
// src/api/services/membersService.ts (generated)
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const membersApi = createApi({
  reducerPath: 'membersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  endpoints: (builder) => ({
    getMembers: builder.query<MemberListOut, GetMembersParams>({
      query: (params) => ({ url: '/members/', params }),
    }),
    createMember: builder.mutation<MemberOut, MemberCreate>({
      query: (body) => ({ url: '/members/', method: 'POST', body }),
    }),
    // ... all endpoints from the tag
  }),
});

export const { useGetMembersQuery, useCreateMemberMutation } = membersApi;
```

## Adding New Endpoints to Frontends

After adding a new route in gms_service:

1. Ensure gms_service is running on port 8200
2. Verify the new endpoint appears in the OpenAPI spec: `curl http://localhost:8200/api/openapi.json`
3. Run `npm run generate-api` in the frontend(s)
4. The new hook (e.g., `useGetNewEndpointQuery`) will be available in `@/api/services/`
