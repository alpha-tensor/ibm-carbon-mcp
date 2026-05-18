import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getRawGitHubFile, getGitHubRepoTree } from "../src/api/github.js";
import { ensureDirectory, getMirroredRepoPath } from "../src/utils/files.js";

interface SyncTarget {
  owner: string;
  repo: string;
  branch: string;
  includePaths: string[];
  extensions: string[];
}

const targets: SyncTarget[] = [
  {
    owner: "carbon-design-system",
    repo: "carbon",
    branch: "main",
    includePaths: ["docs", "packages/react", "packages/web-components"],
    extensions: [".md", ".mdx"],
  },
  {
    owner: "carbon-design-system",
    repo: "ibm-products",
    branch: "main",
    includePaths: ["packages/ibm-products/src/components"],
    extensions: [".md", ".mdx"],
  },
  {
    owner: "carbon-design-system",
    repo: "carbon-charts",
    branch: "main",
    includePaths: ["packages/docs", "packages/react", "packages/angular", "packages/vue", "packages/svelte"],
    extensions: [".md", ".mdx"],
  },
];

function isWithinIncludePaths(filePath: string, includePaths: string[]): boolean {
  return includePaths.some((includePath) => filePath === includePath || filePath.startsWith(`${includePath}/`));
}

function matchesExtension(filePath: string, extensions: string[]): boolean {
  return extensions.some((extension) => filePath.toLowerCase().endsWith(extension.toLowerCase()));
}

async function syncTarget(target: SyncTarget): Promise<void> {
  console.log(`\nSyncing ${target.owner}/${target.repo}@${target.branch} ...`);
  const tree = await getGitHubRepoTree(target.owner, target.repo, target.branch);
  const files = tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path)
    .filter((filePath) => isWithinIncludePaths(filePath, target.includePaths))
    .filter((filePath) => matchesExtension(filePath, target.extensions));

  console.log(`Found ${files.length} markdown files to mirror.`);

  const batchSize = 5;
  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    await Promise.all(
      batch.map(async (filePath) => {
        const content = await getRawGitHubFile(target.owner, target.repo, target.branch, filePath);
        const destinationPath = getMirroredRepoPath(target.owner, target.repo, filePath);
        await ensureDirectory(path.dirname(destinationPath));
        await writeFile(destinationPath, content, "utf8");
      })
    );

    const completed = Math.min(index + batch.length, files.length);
    console.log(`Mirrored ${completed}/${files.length}`);
  }
}

async function main(): Promise<void> {
  for (const target of targets) {
    await syncTarget(target);
  }

  console.log("\nDone. Local markdown mirror is ready under .cache/github-mirror.");
}

main().catch((error) => {
  console.error("Failed to sync Carbon markdown:", error);
  process.exit(1);
});
