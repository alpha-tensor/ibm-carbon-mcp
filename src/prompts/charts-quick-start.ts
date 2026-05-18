export const listing = {
  name: "carbon-charts-quick-start",
  description: "Get started with IBM Carbon Charts across various frameworks",
  arguments: [
    {
      name: "framework",
      description: "Framework to use (react, angular, vue, svelte, vanilla)",
      required: true,
    },
    {
      name: "chartType",
      description: "Type of chart to implement initially (e.g., 'BarChart', 'LineChart')",
      required: false,
    }
  ],
};

export const handler = async (args: Record<string, string | undefined>) => {
  const framework = args?.framework?.toLowerCase() || "vanilla";
  const chartType = args?.chartType || "BarChart";

  const text = `
You are an expert developer helping a user set up a new project with IBM Carbon Charts.
The user is integrating Carbon Charts into a **${framework}** project.

Please guide the user through the following steps:

1. **Installation:**
   Instruct them to install the necessary packages.
   The base package is \`@carbon/charts\`.
   For ${framework}, they also need the specific wrapper package (e.g., \`@carbon/charts-${framework === 'vanilla' ? 'core' : framework}\`). D3 is a peer dependency, so remind them to install \`d3\`.

2. **Styling Setup:**
   Explain how to import the Carbon Charts styles. They should import the CSS provided by the library:
   \`import '@carbon/charts/styles.css';\` (or the appropriate SCSS import if they are using Sass).

3. **Basic Implementation:**
   Provide a basic example of a ${chartType} in ${framework}.
   Use the \`get_charts\` tool on this MCP server (passing \`query="${chartType}"\` and \`framework="${framework}"\`) to retrieve an accurate code example directly from the Carbon Charts repository.

4. **Configuration & Data:**
   Explain the basic structure of Carbon Charts options:
   - \`data\`: Array of objects.
   - \`options\`: Configuration object covering title, axes, legend, etc.

5. **Next Steps:**
   Suggest checking the Carbon Charts website (https://carbon-design-system.github.io/carbon-charts/) for more examples and API references.
`;

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: text.trim(),
        },
      },
    ],
  };
};
