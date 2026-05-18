import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  RootsListChangedNotificationSchema,
  InitializedNotificationSchema,
  SetLevelRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerResourceHandlers } from "./handlers/resources.js";
import { registerToolHandlers } from "./handlers/tools.js";
import { registerPromptHandlers } from "./handlers/prompts.js";
import { DocumentationService } from "./services/documentation.js";
import { detectAndSetProject } from "./state/project.js";

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
      },
    );

    this.setupHandlers();
    this.setupNotificationHandlers();

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

    // Add SetLevel support like ag-mcp
    this.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
      const { level } = request.params;
      console.error(`Log level set to: ${level}`);
      return {};
    });
  }

  private setupNotificationHandlers() {
    // Detect project roots like ag-mcp
    this.server.setNotificationHandler(
      RootsListChangedNotificationSchema,
      async () => {
        try {
          const rootPath = process.cwd();
          const project = await detectAndSetProject(rootPath);
          if (project) {
            this.log(
              `Detected IBM Carbon project: ${project.version || "unknown"} (${project.framework})`,
            );
          }
        } catch (error) {
          // No Carbon project detected, ignore
        }
      },
    );

    this.server.setNotificationHandler(InitializedNotificationSchema, () => {
      // Server initialization complete
      this.log("IBM Carbon MCP Server initialized");
    });
  }

  /**
   * Structured logging like ag-mcp
   */
  private log(message: string) {
    this.server.sendLoggingMessage({
      level: "info",
      data: message,
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("IBM Carbon MCP server running on stdio");
  }
}
