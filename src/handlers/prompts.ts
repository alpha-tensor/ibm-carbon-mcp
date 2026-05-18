import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { DocumentationService } from "../services/documentation.js";
import * as reactQuickStart from "../prompts/react-quick-start.js";
import * as chartsQuickStart from "../prompts/charts-quick-start.js";
import * as carbonBuilder from "../prompts/carbon-builder.js";

const prompts = [reactQuickStart, chartsQuickStart, carbonBuilder];

export function registerPromptHandlers(
  server: Server,
  documentationService: DocumentationService,
) {
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: prompts.map((p) => p.listing),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const args = request.params.arguments as
      | Record<string, string | undefined>
      | undefined;

    const prompt = prompts.find((p) => p.listing.name === promptName);

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    const response = await prompt.handler(args || {});
    return response as any;
  });
}
