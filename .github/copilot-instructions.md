# redux-toolkit-swagger-gen — OpenAPI Code Generator

## Purpose

In-house CLI tool. Reads the gms_service OpenAPI spec and generates complete TypeScript RTK Query API clients for `gms/` and `247FitHome/`.

## Cardinal Rules

1. **Source of truth** — Pydantic schemas in `gms_service/` define everything. The generator just transforms them.
2. **Never break the contract** — generated output must be type-safe and match the OpenAPI spec exactly.
3. **Both frontends** — changes here affect both `gms/` and `247FitHome/`. Test both.
4. **Prettier-formatted** — all output files must be formatted with Prettier before writing.
5. **Template-driven** — logic lives in `src/generator.js`; presentation lives in `src/templates/*.mustache`.

## Commands

```bash
# Install
npm install

# Test generation against running gms_service:
cd ../gms && npm run generate-api

# Link changes for immediate testing:
npm install  # re-installs from file: reference
```

## See Also

- `ARCHITECTURE.md` — full generator reference
- `../gms/openapi.json` — committed spec snapshot
- `../gms_service/ARCHITECTURE.md` — backend that produces the spec
