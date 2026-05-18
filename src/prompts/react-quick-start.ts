export const listing = {
  name: "carbon-react-quick-start",
  description: "Get started with IBM Carbon React components",
  arguments: [
    {
      name: "typescript",
      description: "Whether the project uses TypeScript (true/false)",
      required: false,
    },
    {
      name: "components",
      description: "Specific components to include in the setup (e.g., 'Button, DataTable')",
      required: false,
    }
  ],
};

export const handler = async (args: Record<string, string | undefined>) => {
  const isTs = args?.typescript === "true" || args?.typescript === undefined; // Default to TS
  const components = args?.components || "Button";

  const text = `
You are an expert developer helping a user set up a new project with the IBM Carbon Design System for React (@carbon/react).
${isTs ? "The user is using TypeScript, so ensure all examples include proper typing." : "The user is using plain JavaScript."}

Please guide the user through the following steps:

1. **Installation:**
   Instruct them to install the necessary packages.
   \`npm install @carbon/react\`
   (If they also need icons or pictograms, mention \`@carbon/icons-react\` and \`@carbon/pictograms-react\`).

2. **Styling Setup:**
   Explain how to import the Carbon styles. Carbon relies on Sass.
   They need to import styles into their root SCSS file:
   \`@use '@carbon/react';\`
   Make sure to mention configuring their bundler (Vite, Webpack, Next.js) to support Sass/SCSS.

3. **Basic Implementation:**
   Provide a basic example using the requested components: ${components}.
   Use the \`code_search\` tool if you need to fetch specific implementation details or props for these components from the Carbon repository.
   Also, refer to the \`docs_search\` tool if you need to explain accessibility or usage guidelines for these components.

4. **Next Steps:**
   Suggest checking the Carbon Storybook for interactive examples and the Carbon Design System site for foundational guidelines (colors, typography, spacing).
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
