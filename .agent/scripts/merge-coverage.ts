#!/usr/bin/env bun

/**
 * merge-coverage.ts
 * Merges multiple LCOV files into a single report to calculate overall coverage.
 * Usage: bun run scripts/merge-coverage.ts [coverage_dir]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function mergeCoverage() {
    const coverageDir = process.argv[2] || "coverage";
    console.log(`Merging coverage reports from: ${coverageDir}`);

    let files;
    try {
        files = await readdir(coverageDir);
    } catch (e) {
        console.error(`Could not read coverage directory: ${coverageDir}`);
        process.exit(1);
    }

    const lcovFiles = files.filter(f => f.endsWith(".info") && f !== "merged.info");

    // Fallback: Check recursively if the files argument was just "coverage" and we have subdirs
    // But bun output creates directories like coverage/general or coverage/backend_xxx/
    // So we need to look INSIDE those directories for lcov.info

    const allLcovFiles: string[] = [];

    async function findLcovFiles(dir: string) {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    await findLcovFiles(fullPath);
                } else if (entry.name === "lcov.info") {
                    allLcovFiles.push(fullPath);
                } else if (entry.name.endsWith(".info") && entry.name !== "merged.info") {
                    allLcovFiles.push(fullPath);
                }
            }
        } catch (e) {
            // Ignore access errors
        }
    }

    await findLcovFiles(coverageDir);

    if (allLcovFiles.length === 0) {
        console.log("No LCOV files found.");
        process.exit(0);
    }

    console.log(`Found ${allLcovFiles.length} LCOV files.`);

    // Map: Filename -> Map<LineNumber, HitCount>
    const coverageMap = new Map<string, Map<number, number>>();
    // Map: Filename -> TotalLines (approximation for reporting, or just rely on hit data)
    // Actually LCOV has 'DA:line,count'. We just need to sum counts for same line.

    for (const file of allLcovFiles) {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");

        let currentFile = "";

        for (const line of lines) {
            if (line.startsWith("SF:")) {
                currentFile = line.substring(3).trim();
                // Normalize paths: remove leading src/ to handle frontend vs backend differences
                if (currentFile.startsWith("src/")) {
                    currentFile = currentFile.substring(4);
                }
                if (!coverageMap.has(currentFile)) {
                    coverageMap.set(currentFile, new Map());
                }
            } else if (line.startsWith("DA:")) {
                if (!currentFile) continue;
                const [lineNumStr, countStr] = line.substring(3).split(",");
                const lineNum = parseInt(lineNumStr, 10);
                const count = parseInt(countStr, 10);

                const fileCoverage = coverageMap.get(currentFile)!;
                const currentCount = fileCoverage.get(lineNum) || 0;
                fileCoverage.set(lineNum, currentCount + count);
            }
        }
    }

    // Reconstruct LCOV file
    let mergedContent = "";
    let totalLines = 0;
    let coveredLines = 0;

    for (const [file, linesMap] of coverageMap) {
        mergedContent += `SF:${file}\n`;
        const sortedLines = Array.from(linesMap.keys()).sort((a, b) => a - b);

        let fileHit = 0;
        let fileTotal = 0;

        for (const lineNum of sortedLines) {
            const count = linesMap.get(lineNum)!;
            mergedContent += `DA:${lineNum},${count}\n`;
            fileTotal++;
            if (count > 0) fileHit++;
        }

        mergedContent += `LH:${fileHit}\n`;
        mergedContent += `LF:${fileTotal}\n`;
        mergedContent += "end_of_record\n";

        totalLines += fileTotal;
        coveredLines += fileHit;
    }

    await writeFile(join(coverageDir, "merged.info"), mergedContent);
    console.log(`Merged ${allLcovFiles.length} files into ${join(coverageDir, "merged.info")}`);

    // Calculate simple percentage
    const percent = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
    console.log(`Overall Coverage: ${percent.toFixed(2)}% (${coveredLines}/${totalLines} lines)`);

    // Output the percentage as the last line for easy parsing
    console.log(`FINAL_COVERAGE=${percent.toFixed(2)}`);
}

mergeCoverage().catch(console.error);
