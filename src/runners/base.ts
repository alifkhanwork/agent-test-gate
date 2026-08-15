export interface RunTestsOptions {
  testFiles: string[];
  cwd: string;
  extraArgs?: string[];
  runAll?: boolean;
}

export interface TestRunResult {
  success: boolean;
  exitCode: number;
  runnerName: string;
  ranAll: boolean;
  output: string;
}

export interface TestRunnerAdapter {
  name: string;
  detect(cwd: string): Promise<boolean>;
  runTests(options: RunTestsOptions): Promise<TestRunResult>;
}
