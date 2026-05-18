#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'dist', 'index.js');
const srcPath = path.join(projectRoot, 'src', 'index.ts');

if (fs.existsSync(distPath)) {
  // Run the compiled code
  const child = spawn('node', [distPath], {
    stdio: 'inherit',
    shell: false
  });
  child.on('exit', (code) => process.exit(code || 0));
} else {
  // Fallback to running source with tsx
  // We check if tsx is available in the node_modules
  const tsxPath = path.join(projectRoot, 'node_modules', '.bin', 'tsx');

  if (fs.existsSync(tsxPath)) {
    const child = spawn(tsxPath, [srcPath], {
      stdio: 'inherit',
      shell: false
    });
    child.on('exit', (code) => process.exit(code || 0));
  } else {
    console.error('Error: IBM Carbon MCP Server is not built and tsx is not found.');
    console.error('Please run "npm install && npm run build" in the project directory.');
    process.exit(1);
  }
}
