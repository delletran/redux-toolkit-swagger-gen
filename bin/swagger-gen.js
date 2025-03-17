#!/usr/bin/env node

try {
  const { main } = require('../dist/generate.js');
  main().catch((error) => {
    console.error('Failed to generate API client:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('Failed to load generator:', error);
  process.exit(1);
}
