// Base Types for Carbon API Responses
// Note: These will be expanded as we integrate with actual Carbon data sources

export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  // Metadata for filtering or context
  type?: "component" | "icon" | "pictogram" | "chart" | "guideline";
  framework?: string;
}

// Representing a file fetched from GitHub
export interface GitHubFileMeta {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  status?: number;
}
