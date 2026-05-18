import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DocumentationService } from "../services/documentation.js";

export function registerToolHandlers(server: Server, documentationService: DocumentationService) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "docs_search",
        description: "Search Carbon Design System and IBM Products documentation, including component guidance, usage, accessibility, and reference docs.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query for documentation"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "code_search",
        description: "Search Carbon React, Web Components, and IBM Products code examples. Returns Storybook stories (*.stories.js) and MDX docs for usage context.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The component, icon, or pictogram to search for (e.g., 'Datagrid', 'Button')"
            },
            repo: {
              type: "string",
              description: "The specific repository to search in",
              enum: ["carbon", "ibm-products"],
              default: "carbon"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_charts",
        description: "Search Carbon Charts code examples across React, Angular, Vue, Svelte, Vanilla JS, and HTML.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The chart type or feature to search for (e.g., 'bar chart', 'axes')"
            },
            framework: {
              type: "string",
              description: "The target framework",
              enum: ["react", "angular", "vue", "svelte", "vanilla", "html"]
            }
          },
          required: ["query"]
        }
      }
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;
      let results;

      switch (name) {
        case "docs_search": {
          const query = (args as Record<string, unknown>)?.query as string;
          if (!query) throw new Error("Missing required argument: query");
          results = await documentationService.searchDocs(query);
          break;
        }
        case "code_search": {
          const argsDict = args as Record<string, unknown>;
          const query = argsDict?.query as string;
          const repo = (argsDict?.repo as string) || "carbon";
          if (!query) throw new Error("Missing required argument: query");
          results = await documentationService.searchCode(query, repo);
          break;
        }
        case "get_charts": {
          const argsDict = args as Record<string, unknown>;
          const query = argsDict?.query as string;
          const framework = argsDict?.framework as string | undefined;
          if (!query) throw new Error("Missing required argument: query");
          results = await documentationService.getCharts(query, framework);
          break;
        }
        default:
          throw new Error(`Tool not found: ${name}`);
      }

      return {
        content: results.map(res => ({
          type: "text",
          text: `Title: ${res.title}\nURL: ${res.url}\n\nContent:\n${res.content}`
        }))
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  });
}
