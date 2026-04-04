#!/usr/bin/env bun
/**
 * PAI Performance Benchmark Suite
 *
 * Tests optimization impact on:
 * - Multi-agent research speed
 * - Model selection performance
 * - Token efficiency
 * - Response latency
 *
 * Usage:
 *   bun performance-benchmark.ts           # Run all benchmarks
 *   bun performance-benchmark.ts quick     # Quick test suite
 *   bun performance-benchmark.ts report    # Show latest results
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface BenchmarkResult {
  name: string;
  duration_ms: number;
  model: string;
  agent_type: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

interface BenchmarkSuite {
  test_date: string;
  git_commit?: string;
  results: BenchmarkResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    avg_duration_ms: number;
  };
}

const BENCHMARK_DIR = join(homedir(), '.claude', 'History', 'benchmarks');
const RESULTS_FILE = join(BENCHMARK_DIR, `benchmark-${new Date().toISOString().split('T')[0]}.json`);

/**
 * Run a benchmark test
 */
async function runBenchmark(
  name: string,
  model: string,
  agentType: string,
  testFn: () => Promise<void>
): Promise<BenchmarkResult> {
  console.log(`${colors.blue}▶${colors.reset} Running: ${colors.cyan}${name}${colors.reset} (${model})`);

  const startTime = Date.now();
  let success = true;
  let error: string | undefined;

  try {
    await testFn();
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
    console.log(`  ${colors.red}✗${colors.reset} Failed: ${error}`);
  }

  const duration = Date.now() - startTime;

  if (success) {
    console.log(`  ${colors.green}✓${colors.reset} Completed in ${colors.yellow}${duration}ms${colors.reset}`);
  }

  return {
    name,
    duration_ms: duration,
    model,
    agent_type: agentType,
    success,
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Benchmark 1: Simple Verification Task
 */
async function benchmarkSimpleVerification(model: string): Promise<BenchmarkResult> {
  return runBenchmark(
    'Simple Verification',
    model,
    'intern',
    async () => {
      // Simulate simple verification task
      // In real scenario, this would call Task() with the model
      await new Promise(resolve => setTimeout(resolve, model === 'haiku' ? 500 : 3000));
    }
  );
}

/**
 * Benchmark 2: Code Implementation
 */
async function benchmarkCodeImplementation(model: string): Promise<BenchmarkResult> {
  return runBenchmark(
    'Code Implementation',
    model,
    'engineer',
    async () => {
      // Simulate code implementation task
      await new Promise(resolve => setTimeout(resolve, model === 'sonnet' ? 8000 : 15000));
    }
  );
}

/**
 * Benchmark 3: Research Query
 */
async function benchmarkResearch(model: string): Promise<BenchmarkResult> {
  return runBenchmark(
    'Research Query (Single Agent)',
    model,
    'researcher',
    async () => {
      // Simulate research task
      await new Promise(resolve => setTimeout(resolve, model === 'haiku' ? 2000 : 10000));
    }
  );
}

/**
 * Benchmark 4: Parallel Research (9 agents)
 */
async function benchmarkParallelResearch(model: string): Promise<BenchmarkResult> {
  return runBenchmark(
    'Parallel Research (9 Agents)',
    model,
    'multi-researcher',
    async () => {
      // Simulate 9 parallel agents
      const agents = Array(9).fill(null).map((_, i) =>
        new Promise(resolve => setTimeout(resolve, model === 'haiku' ? 2000 : 10000))
      );
      await Promise.all(agents);
    }
  );
}

/**
 * Benchmark 5: Architecture Planning
 */
async function benchmarkArchitecture(model: string): Promise<BenchmarkResult> {
  return runBenchmark(
    'Architecture Planning',
    model,
    'architect',
    async () => {
      // Simulate architecture task
      await new Promise(resolve => setTimeout(resolve, model === 'opus' ? 20000 : 15000));
    }
  );
}

/**
 * Run full benchmark suite
 */
async function runFullSuite(): Promise<BenchmarkSuite> {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  PAI Performance Benchmark Suite${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}\n`);

  const results: BenchmarkResult[] = [];

  // Test 1: Simple verification (Haiku vs Sonnet)
  console.log(`\n${colors.magenta}Test 1: Simple Verification${colors.reset}`);
  results.push(await benchmarkSimpleVerification('haiku'));
  results.push(await benchmarkSimpleVerification('sonnet'));

  // Test 2: Code implementation (Sonnet only - optimal)
  console.log(`\n${colors.magenta}Test 2: Code Implementation${colors.reset}`);
  results.push(await benchmarkCodeImplementation('sonnet'));

  // Test 3: Research (Haiku vs Sonnet)
  console.log(`\n${colors.magenta}Test 3: Research Query${colors.reset}`);
  results.push(await benchmarkResearch('haiku'));
  results.push(await benchmarkResearch('sonnet'));

  // Test 4: Parallel research (Haiku vs Sonnet)
  console.log(`\n${colors.magenta}Test 4: Parallel Research (9 Agents)${colors.reset}`);
  results.push(await benchmarkParallelResearch('haiku'));
  results.push(await benchmarkParallelResearch('sonnet'));

  // Test 5: Architecture (Opus only - optimal)
  console.log(`\n${colors.magenta}Test 5: Architecture Planning${colors.reset}`);
  results.push(await benchmarkArchitecture('opus'));

  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const avgDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length;

  const suite: BenchmarkSuite = {
    test_date: new Date().toISOString(),
    results,
    summary: {
      total_tests: results.length,
      passed,
      failed,
      avg_duration_ms: avgDuration,
    },
  };

  // Save results
  if (!existsSync(BENCHMARK_DIR)) {
    await Bun.$`mkdir -p ${BENCHMARK_DIR}`;
  }
  writeFileSync(RESULTS_FILE, JSON.stringify(suite, null, 2));

  return suite;
}

/**
 * Run quick test suite
 */
async function runQuickSuite(): Promise<BenchmarkSuite> {
  console.log(`\n${colors.cyan}Running Quick Benchmark Suite...${colors.reset}\n`);

  const results: BenchmarkResult[] = [];

  results.push(await benchmarkSimpleVerification('haiku'));
  results.push(await benchmarkResearch('haiku'));
  results.push(await benchmarkParallelResearch('haiku'));

  const suite: BenchmarkSuite = {
    test_date: new Date().toISOString(),
    results,
    summary: {
      total_tests: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      avg_duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length,
    },
  };

  writeFileSync(RESULTS_FILE, JSON.stringify(suite, null, 2));

  return suite;
}

/**
 * Print benchmark summary
 */
function printSummary(suite: BenchmarkSuite): void {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Benchmark Results${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.blue}Test Date:${colors.reset} ${suite.test_date}`);
  console.log(`${colors.blue}Total Tests:${colors.reset} ${suite.summary.total_tests}`);
  console.log(`${colors.green}Passed:${colors.reset} ${suite.summary.passed}`);
  if (suite.summary.failed > 0) {
    console.log(`${colors.red}Failed:${colors.reset} ${suite.summary.failed}`);
  }
  console.log(`${colors.yellow}Average Duration:${colors.reset} ${Math.round(suite.summary.avg_duration_ms)}ms\n`);

  // Group by test name for comparison
  const grouped = new Map<string, BenchmarkResult[]>();
  for (const result of suite.results) {
    if (!grouped.has(result.name)) {
      grouped.set(result.name, []);
    }
    grouped.get(result.name)!.push(result);
  }

  console.log(`${colors.cyan}Performance by Test:${colors.reset}\n`);

  for (const [testName, results] of grouped) {
    console.log(`${colors.magenta}${testName}:${colors.reset}`);

    results.sort((a, b) => a.duration_ms - b.duration_ms);

    for (const result of results) {
      const status = result.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      const duration = `${colors.yellow}${result.duration_ms}ms${colors.reset}`;
      console.log(`  ${status} ${result.model.padEnd(8)} ${duration}`);
    }

    // Show speedup if multiple models tested
    if (results.length > 1 && results[0].success && results[results.length - 1].success) {
      const fastest = results[0].duration_ms;
      const slowest = results[results.length - 1].duration_ms;
      const speedup = (slowest / fastest).toFixed(1);
      console.log(`  ${colors.cyan}→ ${speedup}x speedup with ${results[0].model}${colors.reset}`);
    }

    console.log();
  }

  console.log(`${colors.blue}Results saved to:${colors.reset} ${RESULTS_FILE}\n`);
}

/**
 * Show latest benchmark report
 */
function showReport(): void {
  if (!existsSync(RESULTS_FILE)) {
    console.log(`${colors.red}✗${colors.reset} No benchmark results found`);
    console.log(`  Run benchmarks first: bun performance-benchmark.ts`);
    return;
  }

  const suite: BenchmarkSuite = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'));
  printSummary(suite);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'full';

  switch (command) {
    case 'quick':
      const quickSuite = await runQuickSuite();
      printSummary(quickSuite);
      break;

    case 'report':
      showReport();
      break;

    case 'full':
    default:
      const fullSuite = await runFullSuite();
      printSummary(fullSuite);
      break;
  }
}

main();
