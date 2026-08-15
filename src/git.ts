import { execSync } from "node:child_process";
import path from "node:path";

export interface GetChangedFilesOptions {
  staged?: boolean;
  commitRange?: string;
  cwd?: string;
}

export function getChangedFiles(options: GetChangedFilesOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  let cmd = "git diff --name-only";

  if (options.commitRange) {
    cmd = `git diff --name-only ${options.commitRange}`;
  } else if (options.staged) {
    cmd = "git diff --cached --name-only";
  } else {
    // If no specific options provided, check staged + unstaged HEAD diff
    cmd = "git diff HEAD --name-only";
  }

  try {
    const stdout = execSync(cmd, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
    const lines = stdout
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(file => file.replace(/\\/g, "/"));

    return Array.from(new Set(lines));
  } catch (err) {
    // Fallback if git HEAD doesn't exist yet or not a git repo
    try {
      const fallbackStdout = execSync("git status --porcelain", { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
      const lines = fallbackStdout
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => line.substring(3).trim())
        .map(file => file.replace(/\\/g, "/"));
      return Array.from(new Set(lines));
    } catch {
      return [];
    }
  }
}
