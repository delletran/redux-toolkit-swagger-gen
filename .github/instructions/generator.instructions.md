---
description: "Use when modifying the generator logic, Mustache templates, or CLI options — adding new output types, fixing generation bugs, or supporting new OpenAPI features."
applyTo: "src/**/*.{js,ts}"
---

# Code Generator Conventions

## Architecture

```
index.js           ← CLI entry point (yargs)
src/
├── generator.js   ← Orchestrates: fetch spec → parse → render → write
├── parser.js      ← OpenAPI schema → internal representation
├── templates/     ← Mustache templates (one per output type)
│   ├── service.mustache    → RTK Query createApi service
│   ├── model.mustache      → Zod schema + TypeScript type
│   ├── slice.mustache      → Redux slice
│   └── store.mustache      → Combined Redux store
└── utils/
    ├── naming.js  ← camelCase, PascalCase converters
    └── types.js   ← OpenAPI type → TypeScript/Zod type mapping
```

## Mustache Template Rules

```mustache
{{! Use triple-stache for unescaped code output }}
{{{typeDefinition}}}

{{! Partials for shared boilerplate }}
{{> imports}}

{{! Sections for conditional blocks }}
{{#hasQueryParams}}
  params: { {{#queryParams}}{{name}}: {{type}}, {{/queryParams}} }
{{/hasQueryParams}}
```

- Never put business logic in templates — only presentation.
- Keep templates under 100 lines; extract shared blocks to partials.

## TypeScript Type Mapping

| OpenAPI type | TypeScript type | Zod schema |
|---|---|---|
| `string` | `string` | `z.string()` |
| `integer` | `number` | `z.number().int()` |
| `number` | `number` | `z.number()` |
| `boolean` | `boolean` | `z.boolean()` |
| `array` of T | `T[]` | `z.array(T)` |
| `object` with `$ref` | `PascalCase(ref name)` | `PascalCaseSchema` |
| nullable field | `T \| null` | `.nullable()` |
| optional field | `T \| undefined` | `.optional()` |

## Testing Generator Changes

```bash
# 1. Start gms_service
cd ../../gms_service && uvicorn app.main:app --port 8200

# 2. Run generation in gms/
cd ../gms && npm install && npm run generate-api

# 3. TypeScript check
npx tsc --noEmit

# 4. Also test 247FitHome/
cd ../247FitHome && npm install && npm run generate-api && npx tsc --noEmit
```

Both frontends must type-check cleanly after generator changes.
