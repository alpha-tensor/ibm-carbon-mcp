#!/usr/bin/env node
import { CarbonServer } from "./server.js";

const server = new CarbonServer();
server.run().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
