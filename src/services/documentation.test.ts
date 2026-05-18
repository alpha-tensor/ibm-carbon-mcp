import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const githubMocks = vi.hoisted(() => ({
  getGitHubRepoTree: vi.fn(),
  getRawGitHubFile: vi.fn(),
}));

const fileMocks = vi.hoisted(() => ({
  getMirroredRepoPath: vi.fn(),
  pathExists: vi.fn(),
  toPosixPath: vi.fn((filePath: string) => filePath.replaceAll("\\", "/")),
  walkFiles: vi.fn(),
}));

vi.mock("../api/github.js", () => ({
  getGitHubRepoTree: githubMocks.getGitHubRepoTree,
  getRawGitHubFile: githubMocks.getRawGitHubFile,
}));

vi.mock("../utils/files.js", () => ({
  getMirroredRepoPath: fileMocks.getMirroredRepoPath,
  pathExists: fileMocks.pathExists,
  toPosixPath: fileMocks.toPosixPath,
  walkFiles: fileMocks.walkFiles,
}));

import { DocumentationService } from "./documentation.js";

function createBlob(pathName: string) {
  return {
    path: pathName,
    mode: "100644",
    type: "blob" as const,
    sha: `${pathName}-sha`,
    url: `https://example.test/${pathName}`,
  };
}

describe("DocumentationService north-star search behavior", () => {
  let mirrorRoot: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mirrorRoot = await mkdtemp(path.join(tmpdir(), "ibm-carbon-mcp-test-"));

    fileMocks.getMirroredRepoPath.mockImplementation(
      (owner: string, repo: string, repoPath = "") =>
        path.join(mirrorRoot, owner, repo, repoPath),
    );

    fileMocks.pathExists.mockImplementation(async (targetPath: string) => {
      try {
        await access(targetPath);
        return true;
      } catch {
        return false;
      }
    });

    fileMocks.walkFiles.mockResolvedValue([]);

    githubMocks.getGitHubRepoTree.mockImplementation(
      async (_owner: string, repo: string) => {
        if (repo === "carbon") {
          return [
            createBlob("packages/react/src/components/Button/Button.stories.js"),
            createBlob("packages/react/src/components/Button/Button.tsx"),
            createBlob("packages/react/src/components/Button/Button.mdx"),
            createBlob("packages/react/src/components/Checkbox/Checkbox.stories.js"),
          ];
        }

        if (repo === "carbon-charts") {
          return [
            createBlob("packages/docs/src/lib/bar/examplesGrouped.ts"),
            createBlob("packages/react/src/charts/GroupedBarChart.ts"),
            createBlob("packages/angular/src/charts/BarChartComponent.ts"),
          ];
        }

        return [];
      },
    );

    githubMocks.getRawGitHubFile.mockImplementation(
      async (_owner: string, repo: string, _branch: string, filePath: string) => {
        const key = `${repo}:${filePath}`;
        const contents: Record<string, string> = {
          "carbon:packages/react/src/components/Button/Button.stories.js": "export const Default = () => <Button kind=\"primary\">Save</Button>;",
          "carbon:packages/react/src/components/Button/Button.tsx": "export function Button() { return <button>Save</button>; }",
          "carbon:packages/react/src/components/Button/Button.mdx": "# Button\n\nUse the Button component for primary actions.",
          "carbon:packages/react/src/components/Checkbox/Checkbox.stories.js": "export const Default = () => <Checkbox labelText=\"Accept\" />;",
          "carbon-charts:packages/docs/src/lib/bar/examplesGrouped.ts": "export const groupedBarExample = { title: 'Grouped bar example', options: { axes: {} } };",
          "carbon-charts:packages/react/src/charts/GroupedBarChart.ts": "export default class GroupedBarChart {}",
          "carbon-charts:packages/angular/src/charts/BarChartComponent.ts": "export class BarChartComponent {}",
        };

        const content = contents[key];
        if (!content) {
          throw new Error(`Unexpected raw file request: ${key}`);
        }

        return content;
      },
    );
  });

  afterEach(async () => {
    await rm(mirrorRoot, { recursive: true, force: true });
  });

  it("finds local mirrored docs by content, not only by file path", async () => {
    const docsFile = path.join(
      mirrorRoot,
      "carbon-design-system",
      "carbon",
      "docs",
      "guides",
      "accessibility.md",
    );

    await mkdir(path.dirname(docsFile), { recursive: true });
    await writeFile(
      docsFile,
      [
        "# Accessibility",
        "",
        "Accessibility Verification Testing includes:",
        "- AVT1 automated checks",
        "- AVT2 manual checks",
        "- AVT3 screen reader verification",
      ].join("\n"),
      "utf8",
    );

    fileMocks.walkFiles.mockImplementation(async (directoryPath: string) => {
      if (directoryPath.endsWith(path.join("carbon-design-system", "carbon", "docs"))) {
        return [docsFile];
      }

      return [];
    });

    const service = new DocumentationService();
    const results = await service.searchDocs("AVT3");

    expect(results[0]).toMatchObject({
      title: "accessibility.md",
      type: "guideline",
    });
    expect(results[0].url).toContain("docs/guides/accessibility.md");
    expect(results[0].content).toContain("AVT3");
  });

  it("prefers storybook examples as the primary code search result", async () => {
    const service = new DocumentationService();
    const results = await service.searchCode("Button");

    expect(results[0]).toMatchObject({
      title: "Button.stories.js",
      type: "component",
    });
    expect(results[0].content).toContain("export const Default");
    expect(results[0].url).toContain("packages/react/src/components/Button/Button.stories.js");
  });

  it("prefers chart examples for the requested framework", async () => {
    const service = new DocumentationService();
    const results = await service.getCharts("bar", "react");

    expect(results[0]).toMatchObject({
      title: "examplesGrouped.ts",
      type: "chart",
      framework: "react",
    });
    expect(results[0].content).toContain("Grouped bar example");
    expect(results[0].url).toContain("packages/docs/src/lib/bar/examplesGrouped.ts");
  });
});
