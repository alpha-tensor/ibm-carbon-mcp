import path from "node:path";
import {
  getRawGitHubFile,
  getGitHubRepoTree,
  type GitHubTreeItem,
} from "../api/github.js";
import { SearchResult } from "../api/index.js";
import {
  getMirroredRepoPath,
  pathExists,
  toPosixPath,
  walkFiles,
} from "../utils/files.js";
import { loadOrBuildIndex, type SearchIndex } from "./search-index.js";

interface RepositoryTarget {
  owner: string;
  repo: string;
  branch: string;
  includePaths: string[];
  extensions: string[];
}

interface QueryParts {
  original: string;
  normalized: string;
  compact: string;
  terms: string[];
}

interface CandidateFile {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  url: string;
  localPath?: string;
  pathScore: number;
  contentScore?: number;
  framework?: string;
}

type SearchMode = "docs" | "code" | "charts";

const DEFAULT_BRANCH = "main";
const MAX_RESULTS = 5;
const MAX_REMOTE_CONTENT_FETCHES = 8;
const MAX_DOC_EXCERPT_LENGTH = 1800;
const MAX_CODE_CONTENT_LENGTH = 12000;

const DOCS_TARGETS: RepositoryTarget[] = [
  {
    owner: "carbon-design-system",
    repo: "carbon",
    branch: DEFAULT_BRANCH,
    includePaths: ["docs", "packages/react", "packages/web-components"],
    extensions: [".md", ".mdx"],
  },
  {
    owner: "carbon-design-system",
    repo: "ibm-products",
    branch: DEFAULT_BRANCH,
    includePaths: ["packages/ibm-products/src/components"],
    extensions: [".md", ".mdx"],
  },
  {
    owner: "carbon-design-system",
    repo: "carbon-labs",
    branch: DEFAULT_BRANCH,
    includePaths: ["examples"],
    extensions: [".md", ".mdx"],
  },
];

const CARBON_CODE_TARGET: RepositoryTarget = {
  owner: "carbon-design-system",
  repo: "carbon",
  branch: DEFAULT_BRANCH,
  includePaths: [
    "packages/react/src/components",
    "packages/web-components",
    "packages/icons",
    "packages/pictograms",
    "packages/styles",
  ],
  extensions: [".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".scss", ".css"],
};

const IBM_PRODUCTS_CODE_TARGET: RepositoryTarget = {
  owner: "carbon-design-system",
  repo: "ibm-products",
  branch: DEFAULT_BRANCH,
  includePaths: ["packages/ibm-products/src/components"],
  extensions: [".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".scss", ".css"],
};

const CHARTS_TARGET: RepositoryTarget = {
  owner: "carbon-design-system",
  repo: "carbon-charts",
  branch: DEFAULT_BRANCH,
  includePaths: [
    "packages/docs/src/lib",
    "packages/docs/src/components",
    "packages/react/src",
    "packages/angular/src",
    "packages/vue/src",
    "packages/svelte/src",
    "packages/core/src",
  ],
  extensions: [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".html",
    ".scss",
    ".css",
    ".svelte",
    ".vue",
    ".md",
    ".mdx",
  ],
};

const CHARTS_FRAMEWORK_HINTS: Record<string, string[]> = {
  react: ["packages/react", "stackblitz/react", "react"],
  angular: [
    "packages/angular",
    "charts-angular-test",
    "stackblitz/angular",
    "angular",
  ],
  vue: ["packages/vue", "stackblitz/vue", "vue"],
  svelte: ["packages/svelte", "stackblitz/svelte", "svelte"],
  vanilla: ["packages/core", "stackblitz/vanilla", "vanilla"],
  html: ["stackblitz/html", ".html", "html"],
};

function buildQueryParts(query: string): QueryParts {
  const normalized = query.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  const terms = Array.from(
    new Set(normalized.split(/[^a-z0-9]+/g).filter(Boolean)),
  );

  return {
    original: query,
    normalized,
    compact,
    terms,
  };
}

function matchesExtension(filePath: string, extensions: string[]): boolean {
  if (extensions.length === 0) {
    return true;
  }

  const normalizedPath = filePath.toLowerCase();
  return extensions.some((extension) =>
    normalizedPath.endsWith(extension.toLowerCase()),
  );
}

function isWithinIncludePaths(
  filePath: string,
  includePaths: string[],
): boolean {
  if (includePaths.length === 0) {
    return true;
  }

  return includePaths.some(
    (includePath) =>
      filePath === includePath || filePath.startsWith(`${includePath}/`),
  );
}

function scorePath(filePath: string, query: QueryParts): number {
  const normalizedPath = filePath.toLowerCase();
  const baseName = path.basename(normalizedPath);
  const compactBaseName = baseName.replace(/[^a-z0-9]+/g, "");
  const compactPath = normalizedPath.replace(/[^a-z0-9]+/g, "");

  let score = 0;

  if (query.normalized && normalizedPath.includes(query.normalized)) {
    score += 140;
  }

  if (query.compact && compactBaseName === query.compact) {
    score += 240;
  } else if (query.compact && compactBaseName.includes(query.compact)) {
    score += 180;
  } else if (query.compact && compactPath.includes(query.compact)) {
    score += 120;
  }

  for (const term of query.terms) {
    if (baseName.includes(term)) {
      score += 70;
      continue;
    }

    if (
      normalizedPath.includes(`/${term}/`) ||
      normalizedPath.includes(`/${term}.`)
    ) {
      score += 45;
      continue;
    }

    if (normalizedPath.includes(term)) {
      score += 20;
    }
  }

  return score;
}

function scoreContent(content: string, query: QueryParts): number {
  const normalizedContent = content.toLowerCase();
  let score = 0;

  if (query.normalized && normalizedContent.includes(query.normalized)) {
    score += 140;
  }

  for (const term of query.terms) {
    if (normalizedContent.includes(term)) {
      score += 25;
    }
  }

  return score;
}

function getSearchModeBoost(
  filePath: string,
  mode: SearchMode,
  framework?: string,
): number {
  const normalizedPath = filePath.toLowerCase();
  let score = 0;

  if (mode === "code") {
    if (normalizedPath.includes(".stories.")) {
      score += 260;
    }
    if (normalizedPath.endsWith(".mdx")) {
      score += 180;
    }
    if (normalizedPath.includes("/stories/")) {
      score += 120;
    }
    if (
      normalizedPath.endsWith("/readme.md") ||
      normalizedPath.endsWith("/readme.mdx")
    ) {
      score += 80;
    }
  }

  if (mode === "charts") {
    if (normalizedPath.includes("example")) {
      score += 240;
    }
    if (normalizedPath.includes("stackblitz")) {
      score += 180;
    }
    if (normalizedPath.includes("packages/docs/src/lib")) {
      score += 140;
    }
    if (framework && CHARTS_FRAMEWORK_HINTS[framework]) {
      for (const hint of CHARTS_FRAMEWORK_HINTS[framework]) {
        if (normalizedPath.includes(hint.toLowerCase())) {
          score += 60;
        }
      }
    }
  }

  return score;
}

function buildGitHubUrl(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
): string {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
}

function trimContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}\n\n... [truncated]`;
}

function createExcerpt(
  content: string,
  query: QueryParts,
  maxLength: number,
): string {
  const normalizedContent = content.toLowerCase();
  let matchIndex = -1;

  if (query.normalized) {
    matchIndex = normalizedContent.indexOf(query.normalized);
  }

  if (matchIndex === -1) {
    for (const term of query.terms) {
      matchIndex = normalizedContent.indexOf(term);
      if (matchIndex !== -1) {
        break;
      }
    }
  }

  if (matchIndex === -1) {
    return trimContent(content, maxLength);
  }

  const halfWindow = Math.floor(maxLength / 2);
  const start = Math.max(0, matchIndex - halfWindow);
  const end = Math.min(content.length, start + maxLength);
  const prefix = start > 0 ? "...\n" : "";
  const suffix = end < content.length ? "\n..." : "";

  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}

function deduplicateCandidates(candidates: CandidateFile[]): CandidateFile[] {
  const byPath = new Map<string, CandidateFile>();

  for (const candidate of candidates) {
    const key = `${candidate.owner}/${candidate.repo}/${candidate.path}`;
    const existing = byPath.get(key);

    if (!existing || candidate.pathScore > existing.pathScore) {
      byPath.set(key, candidate);
    }
  }

  return Array.from(byPath.values());
}

export class DocumentationService {
  private readonly repoTreeCache = new Map<string, GitHubTreeItem[]>();
  private readonly fileContentCache = new Map<string, string>();
  private searchIndex: SearchIndex | null = null;
  private searchIndexPromise: Promise<SearchIndex | null> | null = null;

  async searchDocs(query: string): Promise<SearchResult[]> {
    console.error(`[Docs Search] Query: ${query}`);

    const queryParts = buildQueryParts(query);
    const localCandidates = await this.findLocalDocCandidates(queryParts);
    const remoteCandidates = await Promise.all(
      DOCS_TARGETS.map((target) =>
        this.findRemotePathCandidates(target, queryParts, "docs"),
      ),
    );

    const combinedCandidates = deduplicateCandidates([
      ...localCandidates,
      ...remoteCandidates.flat(),
    ]).sort((left, right) => {
      const leftScore = left.pathScore + (left.contentScore ?? 0);
      const rightScore = right.pathScore + (right.contentScore ?? 0);
      return rightScore - leftScore;
    });

    const hydratedCandidates = await this.hydrateCandidates(
      combinedCandidates,
      queryParts,
      MAX_REMOTE_CONTENT_FETCHES,
    );

    const matches = hydratedCandidates
      .filter((candidate) => candidate.totalScore > 0)
      .slice(0, MAX_RESULTS)
      .map(({ candidate, content }) => ({
        title: path.basename(candidate.path),
        url: candidate.url,
        content: createExcerpt(content, queryParts, MAX_DOC_EXCERPT_LENGTH),
        type: "guideline" as const,
      }));

    if (matches.length > 0) {
      return matches;
    }

    return [
      {
        title: "No documentation matches found",
        url: "https://github.com/carbon-design-system/carbon/tree/main/docs",
        content: `No documentation match was found for \"${query}\". If you want deeper content matches, run \`npm run sync:carbon-docs\` to build a local markdown mirror and retry.`,
        type: "guideline",
      },
    ];
  }

  async searchCode(
    query: string,
    repo: string = "carbon",
  ): Promise<SearchResult[]> {
    console.error(`[Code Search] Query: ${query}, Repo: ${repo}`);

    const target =
      repo === "ibm-products" ? IBM_PRODUCTS_CODE_TARGET : CARBON_CODE_TARGET;
    const queryParts = buildQueryParts(query);
    const candidates = await this.findRemotePathCandidates(
      target,
      queryParts,
      "code",
    );
    const hydratedCandidates = await this.hydrateCandidates(
      candidates,
      queryParts,
      MAX_REMOTE_CONTENT_FETCHES,
    );

    const matches = hydratedCandidates
      .filter((candidate) => candidate.totalScore > 0)
      .slice(0, MAX_RESULTS)
      .map(({ candidate, content }) => ({
        title: path.basename(candidate.path),
        url: candidate.url,
        content: trimContent(content, MAX_CODE_CONTENT_LENGTH),
        type: this.inferCodeResultType(candidate.path),
      }));

    if (matches.length > 0) {
      return matches;
    }

    const fallbackUrl =
      repo === "ibm-products"
        ? "https://github.com/carbon-design-system/ibm-products/tree/main/packages/ibm-products/src/components"
        : "https://github.com/carbon-design-system/carbon/tree/main/packages";

    return [
      {
        title: "No code matches found",
        url: fallbackUrl,
        content: `No Carbon code example matched \"${query}\" in the ${repo} repository. Try a component name such as \"Button\", \"DataTable\", or a narrower icon/pictogram query.`,
        type: "component",
      },
    ];
  }

  async getCharts(query: string, framework?: string): Promise<SearchResult[]> {
    console.error(
      `[Charts Search] Query: ${query}, Framework: ${framework || "any"}`,
    );

    const normalizedFramework = framework?.toLowerCase();
    const queryParts = buildQueryParts(query);
    const candidates = await this.findRemotePathCandidates(
      CHARTS_TARGET,
      queryParts,
      "charts",
      normalizedFramework,
    );
    const hydratedCandidates = await this.hydrateCandidates(
      candidates,
      queryParts,
      MAX_REMOTE_CONTENT_FETCHES,
    );

    const matches = hydratedCandidates
      .filter((candidate) => candidate.totalScore > 0)
      .slice(0, MAX_RESULTS)
      .map(({ candidate, content }) => ({
        title: path.basename(candidate.path),
        url: candidate.url,
        content: trimContent(content, MAX_CODE_CONTENT_LENGTH),
        type: "chart" as const,
        framework: normalizedFramework,
      }));

    if (matches.length > 0) {
      return matches;
    }

    return [
      {
        title: "No chart matches found",
        url: "https://github.com/carbon-design-system/carbon-charts/tree/main/packages",
        content: `No Carbon Charts example matched \"${query}\"${normalizedFramework ? ` for ${normalizedFramework}` : ""}. Try a chart family like \"bar\", \"line\", or \"scatter\".`,
        type: "chart",
        framework: normalizedFramework,
      },
    ];
  }

  private inferCodeResultType(filePath: string): SearchResult["type"] {
    const normalizedPath = filePath.toLowerCase();

    if (normalizedPath.includes("pictogram")) {
      return "pictogram";
    }

    if (normalizedPath.includes("icon")) {
      return "icon";
    }

    return "component";
  }

  private async getSearchIndex(): Promise<SearchIndex | null> {
    if (this.searchIndex) {
      return this.searchIndex;
    }

    if (this.searchIndexPromise) {
      return this.searchIndexPromise;
    }

    this.searchIndexPromise = (async () => {
      try {
        this.searchIndex = await loadOrBuildIndex();
      } catch {
        console.error(
          "[Docs] Failed to load search index, falling back to brute force",
        );
      }

      return this.searchIndex;
    })();

    return this.searchIndexPromise;
  }

  private async getRepositoryTree(
    target: RepositoryTarget,
  ): Promise<GitHubTreeItem[]> {
    const cacheKey = `${target.owner}/${target.repo}@${target.branch}`;
    const cached = this.repoTreeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tree = await getGitHubRepoTree(
      target.owner,
      target.repo,
      target.branch,
    );
    this.repoTreeCache.set(cacheKey, tree);
    return tree;
  }

  private async findRemotePathCandidates(
    target: RepositoryTarget,
    query: QueryParts,
    mode: SearchMode,
    framework?: string,
  ): Promise<CandidateFile[]> {
    const tree = await this.getRepositoryTree(target);

    return tree
      .filter((item) => item.type === "blob")
      .filter((item) => isWithinIncludePaths(item.path, target.includePaths))
      .filter((item) => matchesExtension(item.path, target.extensions))
      .map((item) => {
        const pathScore =
          scorePath(item.path, query) +
          getSearchModeBoost(item.path, mode, framework);

        return {
          owner: target.owner,
          repo: target.repo,
          branch: target.branch,
          path: item.path,
          url: buildGitHubUrl(
            target.owner,
            target.repo,
            target.branch,
            item.path,
          ),
          pathScore,
          framework,
        };
      })
      .filter((candidate) => candidate.pathScore > 0)
      .sort((left, right) => right.pathScore - left.pathScore)
      .slice(0, MAX_REMOTE_CONTENT_FETCHES * 2);
  }

  private async findLocalDocCandidates(
    query: QueryParts,
  ): Promise<CandidateFile[]> {
    const index = await this.getSearchIndex();

    if (index) {
      return this.findLocalCandidatesViaIndex(query, index);
    }

    return this.findLocalCandidatesViaWalk(query);
  }

  private async findLocalCandidatesViaIndex(
    query: QueryParts,
    index: SearchIndex,
  ): Promise<CandidateFile[]> {
    const rawResults = index.search(query.original, MAX_RESULTS * 4);

    return rawResults.map((scored) => {
      const localPath = getMirroredRepoPath(
        scored.doc.owner,
        scored.doc.repo,
        scored.doc.relPath,
      );

      const pathScore = scorePath(scored.doc.relPath, query);
      const contentScore = scored.score * 100;

      return {
        owner: scored.doc.owner,
        repo: scored.doc.repo,
        branch: "main",
        path: scored.doc.relPath,
        url: scored.doc.url,
        localPath,
        pathScore,
        contentScore,
      };
    });
  }

  private async findLocalCandidatesViaWalk(
    query: QueryParts,
  ): Promise<CandidateFile[]> {
    const candidates: CandidateFile[] = [];

    for (const target of DOCS_TARGETS) {
      const repoRoot = getMirroredRepoPath(target.owner, target.repo);
      if (!(await pathExists(repoRoot))) {
        continue;
      }

      for (const includePath of target.includePaths) {
        const localPath = getMirroredRepoPath(
          target.owner,
          target.repo,
          includePath,
        );
        if (!(await pathExists(localPath))) {
          continue;
        }

        const files = await walkFiles(localPath);
        for (const file of files) {
          const relativePath = toPosixPath(path.relative(repoRoot, file));
          if (!matchesExtension(relativePath, target.extensions)) {
            continue;
          }

          const content = await this.getLocalFileContent(file);
          const pathScore = scorePath(relativePath, query);
          const contentScore = scoreContent(content, query);
          if (pathScore === 0 && contentScore === 0) {
            continue;
          }

          candidates.push({
            owner: target.owner,
            repo: target.repo,
            branch: target.branch,
            path: relativePath,
            url: buildGitHubUrl(
              target.owner,
              target.repo,
              target.branch,
              relativePath,
            ),
            localPath: file,
            pathScore,
            contentScore,
          });
        }
      }
    }

    return candidates;
  }

  private async hydrateCandidates(
    candidates: CandidateFile[],
    query: QueryParts,
    maxRemoteFetches: number,
  ): Promise<
    Array<{ candidate: CandidateFile; content: string; totalScore: number }>
  > {
    const results: Array<{
      candidate: CandidateFile;
      content: string;
      totalScore: number;
    }> = [];
    let remoteFetches = 0;

    for (const candidate of candidates) {
      if (!candidate.localPath && remoteFetches >= maxRemoteFetches) {
        continue;
      }

      const content = await this.getCandidateContent(candidate);
      const contentScore =
        candidate.contentScore ?? scoreContent(content, query);
      const totalScore = candidate.pathScore + contentScore;

      if (!candidate.localPath) {
        remoteFetches += 1;
      }

      if (totalScore === 0) {
        continue;
      }

      results.push({ candidate, content, totalScore });
    }

    return results.sort((left, right) => right.totalScore - left.totalScore);
  }

  private async getCandidateContent(candidate: CandidateFile): Promise<string> {
    if (candidate.localPath) {
      return this.getLocalFileContent(candidate.localPath);
    }

    const cacheKey = `${candidate.owner}/${candidate.repo}@${candidate.branch}:${candidate.path}`;
    const cachedContent = this.fileContentCache.get(cacheKey);
    if (cachedContent) {
      return cachedContent;
    }

    const content = await getRawGitHubFile(
      candidate.owner,
      candidate.repo,
      candidate.branch,
      candidate.path,
    );
    this.fileContentCache.set(cacheKey, content);
    return content;
  }

  private async getLocalFileContent(localPath: string): Promise<string> {
    const cacheKey = `local:${localPath}`;
    const cachedContent = this.fileContentCache.get(cacheKey);
    if (cachedContent) {
      return cachedContent;
    }

    const { readFile } = await import("node:fs/promises");
    const content = await readFile(localPath, "utf8");
    this.fileContentCache.set(cacheKey, content);
    return content;
  }
}
