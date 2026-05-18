import { fetchJson, fetchText } from "./fetch.js";

const GITHUB_API_BASE = "https://api.github.com";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com";

const getGitHubHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ibm-carbon-mcp",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: "file" | "dir";
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  truncated: boolean;
  tree: GitHubTreeItem[];
}

/**
 * Gets the contents of a specific directory in a GitHub repository.
 */
export async function getGitHubDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  branch: string = "main",
): Promise<GitHubContentItem[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  try {
    return await fetchJson<GitHubContentItem[]>(url, {
      headers: getGitHubHeaders(),
    });
  } catch (error) {
    console.error(
      `Failed to fetch GitHub directory contents for ${owner}/${repo}/${path}:`,
      error,
    );
    return [];
  }
}

/**
 * Gets the repository tree for a branch or tree-ish reference.
 */
export async function getGitHubRepoTree(
  owner: string,
  repo: string,
  branch: string = "main",
): Promise<GitHubTreeItem[]> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  try {
    const response = await fetchJson<GitHubTreeResponse>(url, {
      headers: getGitHubHeaders(),
    });
    return response.tree ?? [];
  } catch (error) {
    console.error(
      `Failed to fetch GitHub repository tree for ${owner}/${repo}@${branch}:`,
      error,
    );
    return [];
  }
}

/**
 * Fetches the raw text content of a specific file from GitHub.
 * Bypasses the API rate limit by using raw.githubusercontent.com.
 */
export async function getRawGitHubFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string> {
  const url = `${RAW_GITHUB_BASE}/${owner}/${repo}/${branch}/${path}`;
  try {
    return await fetchText(url, { headers: getGitHubHeaders() });
  } catch (error) {
    console.error(`Failed to fetch raw file from ${url}:`, error);
    throw error;
  }
}
