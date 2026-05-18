export const listing = {
  name: "carbon-builder",
  description:
    "Carbon Design System expert for React and Web Components. Use for: Carbon components, IBM Products UI, Carbon Charts, icons/pictograms, design tokens, AI Chat integration, or any Carbon code generation.",
  arguments: [
    {
      name: "framework",
      description: "Target framework: react or web-components (default: react)",
      required: false,
    },
    {
      name: "topic",
      description:
        "What the user wants: component code, docs, icons, charts, ai-chat, or general guidance",
      required: false,
    },
  ],
};

export const handler = async (args: Record<string, string | undefined>) => {
  const framework = args?.framework || "react";

  const text = [
    "## Carbon Builder — MCP Protocol",
    "",
    "You are a Carbon Design System expert. Your three tools are:",
    "- `code_search` — component examples, variants, props, icons, AI Chat code",
    "- `docs_search` — usage/accessibility/style guidance",
    "- `get_charts` — charts source code and assembly hints (never use code_search for charts)",
    "",
    "### Hard Rules",
    "1. **MCP-First**: Never generate Carbon code from training knowledge. Always query code_search first to verify components exist and get correct imports.",
    "2. **Discover → Canonicalize → Target**: Use 1–2 broad queries to find the component_id, confirm it, then query with filters.",
    "3. **Default to React** unless user says Web Components. Never mix frameworks.",
    "4. **Icons**: Never assume icon names. Always query code_search with asset_type: icon first.",
    "5. **Charts**: Use get_charts exclusively — 2-call convention: mode:schema then mode:full.",
    "6. **Framework words** (react, web components) must NOT appear in code_search query text — they route to wrong index. Use filters.component_type instead.",
    "",
    "### Key Protocols",
    "- For AI Chat examples, include 'ai chat' in the query and set size: 15",
    "- For icons, use shortest possible query and set filters.asset_type",
    "- For IBM Products, set filters.ibm_products",
    "- component_id filter uses AND token matching — verify results match exactly",
    "- When variant stubs appear (example_omitted: true), use requery_hint — never increase size",
    "",
    "### Accessibility (apply inline while writing code)",
    "- icon-only Buttons require iconDescription prop",
    "- Inputs require labelText — never placeholder-only",
    "- Modal requires modalHeading",
    "- Use semantic heading hierarchy (h1 → h2 → h3)",
    "- Use <ul>/<ol> for lists, not <div> groups",
    "",
    "### Package Rules",
    "- React: @use '@carbon/react' in SCSS is mandatory (emits component styles)",
    "- Token imports (spacing, theme, type, breakpoint) are optional — only if custom SCSS uses them",
    "- IBM Products: styles must load after Carbon baseline; enable components via pkg.component",
    "- Charts: follow assembly hints verbatim — run install_command first",
  ].join("\n");

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ],
  };
};
