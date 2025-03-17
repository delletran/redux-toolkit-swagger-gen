#!/usr/bin/env node

import { main, parseArgs } from '../generate';

process.on('unhandledRejection', (error) => {
  console.error('Failed to generate API client:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to generate API client:', error);
  process.exit(1);
});
