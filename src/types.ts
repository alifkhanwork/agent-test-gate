export interface AgentTestGateConfig {
  /** Test runner to use ('vitest' | 'jest' | 'pytest' | string) */
  runner?: string;
  /** Glob patterns of files to include in graph computation */
  include?: string[];
  /** Glob patterns of files to exclude from graph computation */
  exclude?: string[];
  /** Glob patterns identifying test files (e.g. "*.test.ts", "*.spec.ts") */
  testPatterns?: string[];
  /** Confidence threshold (0.0 to 1.0) below which the gate falls back to full test suite */
  confidenceThreshold?: number;
  /** Custom runner arguments */
  runnerArgs?: string[];
  /** Root directory for resolution */
  cwd?: string;
}

export interface FileNodeInfo {
  path: string;
  imports: string[];
  exports?: string[];
  hasDynamicImports?: boolean;
  confidenceScore: number;
  hash: string;
  isTestFile: boolean;
}

export interface CacheSchema {
  version: string;
  timestamp: number;
  files: Record<string, {
    hash: string;
    imports: string[];
    hasDynamicImports: boolean;
    confidenceScore: number;
    isTestFile: boolean;
  }>;
}

export interface AffectedTestsResult {
  changedFiles: string[];
  affectedTests: string[];
  allTests: string[];
  confidenceScore: number;
  fallbackToAll: boolean;
  fallbackReason?: string;
  graph: Record<string, string[]>; // file -> imports
  reverseGraph: Record<string, string[]>; // file -> importedBy
}

export interface RunGateOptions {
  changedFiles?: string[];
  staged?: boolean;
  commitRange?: string;
  runner?: string;
  configPath?: string;
  cwd?: string;
  forceAll?: boolean;
}

export interface GateResult {
  passed: boolean;
  exitCode: number;
  affectedTests: string[];
  ranFullSuite: boolean;
  fallbackReason?: string;
  runnerName: string;
  output: string;
}
