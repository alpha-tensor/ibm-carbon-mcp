# Supporting Documentation

## Project Purpose
The IBM Carbon MCP (Model Context Protocol) Server acts as a bridge between LLM-powered applications (like Claude Desktop or Cursor) and the IBM Carbon ecosystem. It enables AI agents to natively search for and retrieve up-to-date design guidelines, code snippets, and charting examples directly from the Carbon Design System.

## Exposed Tools
The server exposes the following tools to AI applications:

1.  **`docs_search`**:
    *   Searches Carbon Design System and IBM Products documentation.
    *   Returns component guidance, usage, accessibility rules, and reference documentation.
2.  **`code_search`**:
    *   Searches Carbon React/Web Components code examples, icons, and pictograms.
    *   Returns complete example application files to provide AI with proper implementation context.
3.  **`get_charts`**:
    *   Searches Carbon Charts code examples.
    *   Provides filtering across supported frameworks (React, Angular, Vue, Svelte, Vanilla JS, and HTML).
