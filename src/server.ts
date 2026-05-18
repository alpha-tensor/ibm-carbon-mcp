import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResourceHandlers } from "./handlers/resources.js";
import { registerToolHandlers } from "./handlers/tools.js";
import { registerPromptHandlers } from "./handlers/prompts.js";
import { DocumentationService } from "./services/documentation.js";

export class CarbonServer {
  private server: Server;
  private documentationService: DocumentationService;

  constructor() {
    this.documentationService = new DocumentationService();
    
    this.server = new Server(
      {
        name: "ibm-carbon-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: { listChanged: true },
          tools: { listChanged: true },
          prompts: { listChanged: true },
          logging: {},
        },
      }
    );

    this.setupHandlers();
    
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    registerResourceHandlers(this.server, this.documentationService);
    registerToolHandlers(this.server, this.documentationService);
    registerPromptHandlers(this.server, this.documentationService);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("IBM Carbon MCP server running on stdio");
  }
}
