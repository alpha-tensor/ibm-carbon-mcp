import { 
  ListResourcesRequestSchema, 
  ReadResourceRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DocumentationService } from "../services/documentation.js";

export function registerResourceHandlers(server: Server, documentationService: DocumentationService) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    throw new Error(`Resource not found: ${request.params.uri}`);
  });
}
