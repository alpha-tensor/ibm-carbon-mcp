# Long Term Plans

## Phase 1: Project Skeleton & Tool Interfaces
*   [x] Establish project scaffolding (TypeScript, ES Modules, build scripts).
*   [x] Set up standard MCP server architecture (Stido transport, handlers for tools/resources/prompts).
*   [x] Define and register `docs_search`, `code_search`, and `get_charts` tool schemas.
*   [x] Create a `DocumentationService` with mocked responses.

## Phase 2: Data Retrieval Implementation
*   **Docs Search (`docs_search`)**:
    *   Implement a strategy for fetching markdown/HTML from `carbondesignsystem.com` or the backing GitHub repository.
    *   Parse the content to return structured guidance, usage, and accessibility rules.
*   **Code Search (`code_search`)**:
    *   Implement API calls to the Carbon GitHub repository (`packages/react`, `packages/web-components`).
    *   Extract complete file contexts, icon mappings, and pictogram references.
*   **Charts Search (`get_charts`)**:
    *   Implement API calls to the Carbon Charts GitHub repository.
    *   Add robust filtering by framework.

## Phase 3: Indexing and Performance
*   **Local Caching:** Store fetched documentation locally to prevent hitting rate limits (e.g., GitHub API) and to speed up LLM context retrieval.
*   **Vector/Text Search Indexing:** If the dataset grows large, implement a local SQLite or lightweight vector database to improve search query accuracy beyond basic keyword matching.

## Phase 4: Extended Capabilities
*   **Prompts (`src/handlers/prompts.ts`)**: Add standardized prompts (e.g., "Build a Carbon Dashboard") that pre-load essential design tokens, grid guidelines, and shell code into the LLM's context.
*   **Resources (`src/handlers/resources.ts`)**: Expose full Carbon style guidelines (colors, typography, spacing) as direct, readable resources to the AI.
