import fs from "node:fs/promises";
import path from "node:path";

export interface ProjectInfo {
  framework: "react" | "web-components" | "vanilla";
  version?: string;
}

let currentProject: ProjectInfo | null = null;

export function getProject(): ProjectInfo | null {
  return currentProject;
}

export async function detectAndSetProject(rootPath: string): Promise<ProjectInfo | null> {
  try {
    const packageJsonPath = path.join(rootPath, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf8");
    const pkg = JSON.parse(content);

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    let framework: ProjectInfo["framework"] = "vanilla";
    let version: string | undefined;

    if (deps["@carbon/react"] || deps["carbon-components-react"]) {
      framework = "react";
      version = deps["@carbon/react"] || deps["carbon-components-react"];
    } else if (deps["@carbon/web-components"]) {
      framework = "web-components";
      version = deps["@carbon/web-components"];
    }

    currentProject = { framework, version };
    return currentProject;
  } catch {
    return null;
  }
}
