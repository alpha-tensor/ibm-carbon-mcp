#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dist", "index.js");
const srcPath = path.join(projectRoot, "src", "index.ts");

if (fs.existsSync(distPath)) {
  // Run the compiled code
  const child = spawn("node", [distPath], {
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => process.exit(code || 0));
} else {
  // Fallback to running source with tsx
  // Try running 'tsx' directly from the environment (npx should have it in path)
  const child = spawn("npx", ["tsx", srcPath], {
    stdio: "inherit",
    shell: true, // Use shell for npx
  });

  child.on("error", (err) => {
    console.error("Error starting server with tsx:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => process.exit(code || 0));
}
