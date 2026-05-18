import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
let cachedProjectRoot: string | null = null;

export function getProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  let searchDirectory = currentDirectory;
  while (true) {
    if (existsSync(path.join(searchDirectory, "package.json"))) {
      cachedProjectRoot = searchDirectory;
      return searchDirectory;
    }

    const parentDirectory = path.dirname(searchDirectory);
    if (parentDirectory === searchDirectory) {
      cachedProjectRoot = process.cwd();
      return cachedProjectRoot;
    }

    searchDirectory = parentDirectory;
  }
}

export function getGitHubMirrorRoot(): string {
  return path.join(getProjectRoot(), ".cache", "github-mirror");
}

export function getMirroredRepoPath(
  owner: string,
  repo: string,
  repoPath: string = "",
): string {
  const pathSegments = repoPath.split("/").filter(Boolean);
  return path.join(getGitHubMirrorRoot(), owner, repo, ...pathSegments);
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function walkFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }
      return [fullPath];
    }),
  );

  return files.flat();
}
