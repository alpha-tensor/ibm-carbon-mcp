# IBM Carbon MCP Server

An official-grade [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the [IBM Carbon Design System](https://carbondesignsystem.com/).

This server allows AI assistants (like Claude Desktop, Cursor, and Zed) to natively search and retrieve up-to-date design guidelines, code snippets, and chart examples directly from Carbon.

## Features

- **`docs_search`**: Search Carbon Design System and IBM Products documentation (markdown/MDX).
- **`code_search`**: Find Carbon component examples, Storybook files, icons, and pictograms.
- **`get_charts`**: Retrieve Carbon Charts code examples with framework-aware filtering (React, Angular, Vue, Svelte, Vanilla).
- **Carbon Builder Prompt**: A built-in expert system prompt for AI tools to understand Carbon's internal component rules and usage guidelines.

## Installation / Configuration

You can use this server in any MCP-compatible client without explicitly cloning the repository by using `npx`.

### Zed

Add the following to your Zed configuration (`~/.config/zed/settings.json`):

```json
{
  "ibm-carbon-mcp": {
    "command": "npx",
    "args": ["-y", "github:alpha-tensor/ibm-carbon-mcp"]
  }
}
```

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ibm-carbon-mcp": {
      "command": "npx",
      "args": ["-y", "github:alpha-tensor/ibm-carbon-mcp"]
    }
  }
}
```

### Cursor

In Cursor Settings > Features > MCP:

1. Add a new server.
2. Name: `ibm-carbon-mcp`
3. Type: `command`
4. Command: `npx -y github:alpha-tensor/ibm-carbon-mcp`

---

## Local Development & Caching

While standard API fetching works, you can drastically speed up searches and improve accuracy by building a local markdown mirror and search index.

1. Clone the repository:

   ```bash
   git clone git@github.com:alpha-tensor/ibm-carbon-mcp.git
   cd ibm-carbon-mcp
   npm install
   ```

2. Build the local mirror and index:

   ```bash
   npm run sync:carbon-docs
   ```

   _(This downloads the latest markdown from Carbon, IBM Products, and Carbon Charts repos into a local `.cache/github-mirror` directory and builds an inverted search index)._

3. Build and test the server:
   ```bash
   npm run build
   npm test
   ```

If you are running the server locally, update your MCP client configuration to point to your local build:

```json
{
  "mcpServers": {
    "ibm-carbon-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ibm-carbon-mcp/dist/index.js"]
    }
  }
}
```
