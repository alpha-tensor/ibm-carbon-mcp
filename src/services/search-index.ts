import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getGitHubMirrorRoot,
  walkFiles,
  getMirroredRepoPath,
  toPosixPath,
  pathExists,
} from "../utils/files.js";

interface TermEntry {
  term: string;
  idf: number;
  postings: Array<{
    docId: number;
    tf: number;
  }>;
}

interface DocEntry {
  id: number;
  owner: string;
  repo: string;
  relPath: string;
  url: string;
  tokenCount: number;
}

interface IndexMetadata {
  builtAt: string;
  repoCount: number;
  docCount: number;
  termCount: number;
}

export interface SearchIndexData {
  metadata: IndexMetadata;
  docs: DocEntry[];
  terms: Record<string, TermEntry>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 2 && token.length <= 40)
    .filter((token) => !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "have",
  "been",
  "some",
  "them",
  "than",
  "that",
  "this",
  "with",
  "from",
  "will",
  "into",
  "just",
  "about",
  "over",
  "more",
  "each",
  "also",
  "very",
  "would",
  "other",
  "only",
  "when",
  "which",
  "their",
  "what",
  "were",
  "your",
  "its",
  "after",
  "being",
  "does",
  "should",
  "could",
  "these",
  "those",
]);

export class SearchIndex {
  private docs: DocEntry[] = [];
  private terms: Map<string, TermEntry> = new Map();
  private docCount = 0;

  addDocument(
    owner: string,
    repo: string,
    relPath: string,
    content: string,
  ): void {
    const tokens = tokenize(content);
    if (tokens.length === 0) {
      return;
    }

    const docId = this.docCount++;
    const tokenCount = tokens.length;
    const branch = "main";
    const url = `https://github.com/${owner}/${repo}/blob/${branch}/${relPath}`;

    this.docs.push({
      id: docId,
      owner,
      repo,
      relPath,
      url,
      tokenCount,
    });

    const termFrequencies = new Map<string, number>();
    for (const token of tokens) {
      termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
    }

    for (const [term, tf] of termFrequencies) {
      let entry = this.terms.get(term);
      if (!entry) {
        entry = { term, idf: 0, postings: [] };
        this.terms.set(term, entry);
      }

      entry.postings.push({ docId, tf });
    }
  }

  finalize(): void {
    const totalDocs = this.docCount;

    for (const entry of this.terms.values()) {
      const docFrequency = entry.postings.length;
      entry.idf = Math.log(
        1 + (totalDocs - docFrequency + 0.5) / (docFrequency + 0.5),
      );
    }
  }

  search(
    query: string,
    maxResults: number = 20,
  ): Array<{
    doc: DocEntry;
    score: number;
  }> {
    if (this.docCount === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const queryTermFrequencies = new Map<string, number>();
    for (const token of queryTokens) {
      queryTermFrequencies.set(
        token,
        (queryTermFrequencies.get(token) ?? 0) + 1,
      );
    }

    const docScores = new Map<number, number>();

    for (const [term, queryTf] of queryTermFrequencies) {
      const entry = this.terms.get(term);
      if (!entry) {
        continue;
      }

      const queryWeight = queryTf * entry.idf;

      for (const posting of entry.postings) {
        const doc = this.docs[posting.docId];
        if (!doc) {
          continue;
        }

        const docWeight = posting.tf * entry.idf;
        const score = (queryWeight * docWeight) / (doc.tokenCount + 1);

        docScores.set(
          posting.docId,
          (docScores.get(posting.docId) ?? 0) + score,
        );
      }
    }

    return Array.from(docScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([docId, score]) => ({ doc: this.docs[docId], score }));
  }

  toJSON(): SearchIndexData {
    const termsObject: Record<string, TermEntry> = {};
    for (const [key, value] of this.terms) {
      termsObject[key] = value;
    }

    return {
      metadata: {
        builtAt: new Date().toISOString(),
        repoCount: Array.from(
          new Set(this.docs.map((d) => `${d.owner}/${d.repo}`)),
        ).length,
        docCount: this.docCount,
        termCount: this.terms.size,
      },
      docs: this.docs,
      terms: termsObject,
    };
  }

  static fromJSON(data: SearchIndexData): SearchIndex {
    const index = new SearchIndex();
    index.docs = data.docs;
    index.docCount = data.docs.length;
    index.terms = new Map(Object.entries(data.terms));
    return index;
  }
}

const INDEX_CACHE_FILENAME = "search-index.json";

export async function loadOrBuildIndex(): Promise<SearchIndex | null> {
  const mirrorRoot = getGitHubMirrorRoot();
  if (!(await pathExists(mirrorRoot))) {
    return null;
  }

  const cachePath = path.join(mirrorRoot, INDEX_CACHE_FILENAME);

  if (await pathExists(cachePath)) {
    try {
      const raw = await readFile(cachePath, "utf8");
      const data = JSON.parse(raw) as SearchIndexData;
      const index = SearchIndex.fromJSON(data);
      console.error(
        `[SearchIndex] Loaded from cache: ${data.metadata.docCount} docs, ${data.metadata.termCount} terms`,
      );
      return index;
    } catch {
      console.error("[SearchIndex] Cache corrupted, rebuilding");
    }
  }

  const index = await buildIndex();
  if (index) {
    try {
      await writeFile(cachePath, JSON.stringify(index.toJSON()), "utf8");
      console.error("[SearchIndex] Index built and cached to disk");
    } catch {
      console.error("[SearchIndex] Failed to write index cache");
    }
  }

  return index;
}

interface IndexTarget {
  owner: string;
  repo: string;
  includePaths: string[];
}

const INDEX_TARGETS: IndexTarget[] = [
  {
    owner: "carbon-design-system",
    repo: "carbon",
    includePaths: ["docs", "packages/react", "packages/web-components"],
  },
  {
    owner: "carbon-design-system",
    repo: "ibm-products",
    includePaths: ["packages/ibm-products/src/components"],
  },
  {
    owner: "carbon-design-system",
    repo: "carbon-charts",
    includePaths: [
      "packages/docs",
      "packages/react",
      "packages/angular",
      "packages/vue",
      "packages/svelte",
    ],
  },
  {
    owner: "carbon-design-system",
    repo: "carbon-labs",
    includePaths: ["examples"],
  },
];

const INDEX_FILE_EXTENSIONS = new Set([".md", ".mdx"]);

async function buildIndex(): Promise<SearchIndex | null> {
  const index = new SearchIndex();
  let fileCount = 0;

  for (const target of INDEX_TARGETS) {
    for (const includePath of target.includePaths) {
      const dirPath = getMirroredRepoPath(
        target.owner,
        target.repo,
        includePath,
      );
      if (!(await pathExists(dirPath))) {
        continue;
      }

      const files = await walkFiles(dirPath);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!INDEX_FILE_EXTENSIONS.has(ext)) {
          continue;
        }

        const relPath = toPosixPath(
          path.relative(getMirroredRepoPath(target.owner, target.repo), file),
        );

        const content = await readFile(file, "utf8");
        index.addDocument(target.owner, target.repo, relPath, content);
        fileCount++;
      }
    }
  }

  if (index.toJSON().docs.length === 0) {
    return null;
  }

  index.finalize();
  console.error(
    `[SearchIndex] Built from ${fileCount} files, ` +
      `${index.toJSON().docs.length} docs indexed, ` +
      `${index.toJSON().metadata.termCount} unique terms`,
  );

  return index;
}

// CLI entrypoint for `npm run build:index`
const runningDirectly =
  process.argv[1]?.endsWith("search-index.js") ||
  process.argv[1]?.endsWith("search-index.ts");

if (runningDirectly) {
  loadOrBuildIndex().catch((error) => {
    console.error("Failed to build search index:", error);
    process.exit(1);
  });
}
