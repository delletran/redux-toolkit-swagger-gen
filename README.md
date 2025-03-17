# Redux Toolkit Swagger Generator

Generate Redux Toolkit API clients from Swagger/OpenAPI specifications.

## Installation

```bash
npm install redux-toolkit-swagger-gen --save-dev
```

## Usage

### Command Line

```bash
# Using npx
npx swagger-gen --url http://your-api/swagger.json --output src/api

# Or after installing globally
npm install -g redux-toolkit-swagger-gen
swagger-gen --url http://your-api/swagger.json --output src/api
```

### Options

- `--url, -u`: Swagger JSON URL or file path (default: "http://localhost:8000/swagger.json")
- `--output, -o`: Output directory (default: "src/api")
- `--help`: Show help

### Package.json Script

Add to your package.json:

```json
{
  "scripts": {
    "generate-api": "swagger-gen --url http://your-api/swagger.json"
  }
}
```

Then run:

```bash
npm run generate-api
```

## Generated Structure

```
src/api/
├── constants/
├── redux/
├── schema/
├── services/
└── thunks/
```

## Requirements

- Node.js 14+
- React 16.8+
- @reduxjs/toolkit

## License

MIT
