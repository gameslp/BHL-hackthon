#!/usr/bin/env node
/**
 * Post-generation script to fix SDK client import
 *
 * Changes the SDK to use our environment-configured client
 * instead of the default generated client.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sdkPath = join(__dirname, '../src/lib/api/generated/sdk.gen.ts');

let content = readFileSync(sdkPath, 'utf-8');

// Replace client import to use our configured client from client-config
content = content.replace(
  "import { client } from './client.gen';",
  "import { client } from '../client-config';"
);

writeFileSync(sdkPath, content);

console.log('✅ Fixed SDK to use environment-configured client');
