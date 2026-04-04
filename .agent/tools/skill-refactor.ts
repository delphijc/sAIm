#!/usr/bin/env bun

/**
 * skill-refactor.ts
 *
 * Migration tool for refactoring skills to follow the progressive disclosure pattern.
 *
 * Usage:
 *   bun skill-refactor.ts analyze <SkillName>     - Analyze what should be extracted
 *   bun skill-refactor.ts split <SkillName>       - Auto-split skill into SKILL.md + Reference.md
 *   bun skill-refactor.ts validate <SkillName>    - Check compliance with template
 *
 * Examples:
 *   bun skill-refactor.ts analyze ffuf
 *   bun skill-refactor.ts split ffuf --confirm
 *   bun skill-refactor.ts validate create-cli
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Section {
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
  classification: 'keep' | 'extract' | 'unclear';
}

interface AnalysisResult {
  skillName: string;
  totalLines: number;
  sections: Section[];
  keepLines: number;
  extractLines: number;
  unclearLines: number;
  recommendation: string;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: string, text: string): void {
  console.log(`${color}${text}${colors.reset}`);
}

function getPAIDir(): string {
  const paiDir = process.env.PAI_DIR || `${process.env.HOME}/.claude`;
  if (!existsSync(paiDir)) {
    throw new Error(`PAI_DIR not found: ${paiDir}`);
  }
  return paiDir;
}

function getSkillPath(skillName: string): string {
  const paiDir = getPAIDir();
  return join(paiDir, 'Skills', skillName);
}

function readSkillFile(skillName: string): { content: string; path: string } {
  const skillPath = getSkillPath(skillName);
  const skillFilePath = join(skillPath, 'SKILL.md');

  if (!existsSync(skillFilePath)) {
    throw new Error(`Skill file not found: ${skillFilePath}`);
  }

  const content = readFileSync(skillFilePath, 'utf-8');
  return { content, path: skillFilePath };
}

function parseMarkdown(content: string): { frontmatter: string; body: string } {
  const lines = content.split('\n');
  let frontmatterEnd = -1;

  // Find frontmatter end
  if (lines[0]?.startsWith('---')) {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.startsWith('---')) {
        frontmatterEnd = i;
        break;
      }
    }
  }

  if (frontmatterEnd === -1) {
    return { frontmatter: '', body: content };
  }

  const frontmatter = lines.slice(0, frontmatterEnd + 1).join('\n');
  const body = lines.slice(frontmatterEnd + 1).join('\n');
  return { frontmatter, body };
}

function extractSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentSection: Partial<Section> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a heading
    const headingMatch = line?.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.endLine = i - 1;
        currentSection.content = lines
          .slice(currentSection.startLine!, currentSection.endLine! + 1)
          .join('\n');
        sections.push(currentSection as Section);
      }

      // Start new section
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      currentSection = {
        title,
        level,
        startLine: i,
        endLine: i,
      };
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    currentSection.content = lines
      .slice(currentSection.startLine!, currentSection.endLine! + 1)
      .join('\n');
    sections.push(currentSection as Section);
  }

  return sections;
}

function classifySection(title: string, content: string): 'keep' | 'extract' | 'unclear' {
  const lowerTitle = title.toLowerCase();

  // KEEP patterns
  const keepPatterns = [
    'workflow routing',
    'examples',
    'extended context',
    'core principles',
    'quick reference',
  ];

  if (keepPatterns.some(p => lowerTitle.includes(p))) {
    return 'keep';
  }

  // EXTRACT patterns
  const extractPatterns = [
    'detailed methodology',
    'configuration',
    'command reference',
    'best practices',
    'common patterns',
    'troubleshooting',
    'reference',
    'guide',
    'advanced',
    'integration',
    'standards',
    'requirements',
  ];

  if (extractPatterns.some(p => lowerTitle.includes(p))) {
    return 'extract';
  }

  // Default: UNCLEAR
  return 'unclear';
}

function analyzeSkill(skillName: string): AnalysisResult {
  const { content } = readSkillFile(skillName);
  const { frontmatter, body } = parseMarkdown(content);
  const sections = extractSections(body);

  // Classify sections
  sections.forEach(section => {
    section.classification = classifySection(section.title, section.content);
  });

  // Calculate stats
  const keepLines = sections
    .filter(s => s.classification === 'keep')
    .reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0);

  const extractLines = sections
    .filter(s => s.classification === 'extract')
    .reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0);

  const unclearLines = sections
    .filter(s => s.classification === 'unclear')
    .reduce((sum, s) => sum + (s.endLine - s.startLine + 1), 0);

  const totalLines = content.split('\n').length;

  // Generate recommendation
  let recommendation = '';
  if (extractLines > 200) {
    recommendation = '🎯 STRONG CANDIDATE for refactoring - significant content can be extracted';
  } else if (extractLines > 100) {
    recommendation = '✓ GOOD CANDIDATE - moderate amount of content to extract';
  } else if (extractLines > 0) {
    recommendation = '~ MINOR REFACTORING - small amount of content to extract';
  } else {
    recommendation = '✓ WELL-STRUCTURED - already follows minimal pattern';
  }

  return {
    skillName,
    totalLines,
    sections,
    keepLines: keepLines + frontmatter.split('\n').length,
    extractLines,
    unclearLines,
    recommendation,
  };
}

function splitSkill(skillName: string, confirm: boolean = false): void {
  const analysis = analyzeSkill(skillName);
  const { content } = readSkillFile(skillName);
  const { frontmatter, body } = parseMarkdown(content);
  const sections = extractSections(body);

  // Build new SKILL.md (keep minimal sections)
  const keepSections = sections.filter(s => s.classification === 'keep');
  const newSkillContent = frontmatter + '\n\n' +
    keepSections.map(s => s.content).join('\n\n') +
    '\n\n## Extended Context\n\nFor detailed information, see `Reference.md`\n';

  // Build Reference.md (extract and unclear sections)
  const extractSections_content = sections
    .filter(s => s.classification === 'extract' || s.classification === 'unclear')
    .map(s => s.content)
    .join('\n\n');

  const referenceContent = `# ${skillName} Reference Guide\n\n> This is Tier 3 documentation for the ${skillName} skill. It's loaded on-demand when you need detailed information. For quick routing and examples, see \`SKILL.md\`.\n\n---\n\n${extractSections_content}\n`;

  const skillPath = getSkillPath(skillName);
  const skillFilePath = join(skillPath, 'SKILL.md');
  const referenceFilePath = join(skillPath, 'Reference.md');

  // Show what will happen
  log(colors.cyan, `\n📋 Refactoring Plan for ${skillName}:`);
  log(colors.dim, `  Current SKILL.md: ${content.split('\n').length} lines`);
  log(colors.green, `  New SKILL.md: ${newSkillContent.split('\n').length} lines`);
  log(colors.green, `  New Reference.md: ${referenceContent.split('\n').length} lines`);
  log(colors.yellow, `  Savings: ${content.split('\n').length - newSkillContent.split('\n').length} lines`);

  if (!confirm) {
    log(colors.yellow, `\n⚠️  Use --confirm flag to actually perform the split`);
    log(colors.dim, `  bun skill-refactor.ts split ${skillName} --confirm`);
    return;
  }

  // Write files
  writeFileSync(skillFilePath, newSkillContent);
  writeFileSync(referenceFilePath, referenceContent);

  log(colors.green, `\n✓ Successfully split ${skillName}!`);
  log(colors.dim, `  Updated: ${skillFilePath}`);
  log(colors.dim, `  Created: ${referenceFilePath}`);
}

function validateSkill(skillName: string): void {
  const { content } = readSkillFile(skillName);
  const { frontmatter } = parseMarkdown(content);
  const lines = content.split('\n');

  const checks = {
    hasFrontmatter: frontmatter.length > 0,
    hasWorkflowRouting: content.includes('## Workflow Routing'),
    hasExamples: content.includes('## Examples'),
    hasExtendedContext: content.includes('## Extended Context') || content.includes('Reference.md'),
    linesUnder120: lines.length <= 120,
    noDetailedSections: !content.includes('## Configuration') &&
                       !content.includes('## Command Reference') &&
                       !content.includes('## Best Practices'),
  };

  log(colors.cyan, `\n✓ Validation Report for ${skillName}:`);
  log(colors.dim, `  Lines: ${lines.length}`);

  for (const [check, passed] of Object.entries(checks)) {
    const icon = passed ? '✓' : '✗';
    const color = passed ? colors.green : colors.red;
    log(color, `  ${icon} ${check}`);
  }

  const allPassed = Object.values(checks).every(v => v);
  if (allPassed) {
    log(colors.green, `\n✓ ${skillName} follows the progressive disclosure pattern!`);
  } else {
    log(colors.yellow, `\n⚠️  ${skillName} needs refactoring`);
  }
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];
const skillName = args[1];
const confirm = args.includes('--confirm');

try {
  if (!command || !skillName) {
    log(colors.cyan, 'skill-refactor - Progressive Disclosure Migration Tool\n');
    log(colors.bright, 'Usage:');
    log(colors.dim, '  bun skill-refactor.ts analyze <SkillName>');
    log(colors.dim, '  bun skill-refactor.ts split <SkillName> [--confirm]');
    log(colors.dim, '  bun skill-refactor.ts validate <SkillName>\n');
    log(colors.bright, 'Examples:');
    log(colors.dim, '  bun skill-refactor.ts analyze ffuf');
    log(colors.dim, '  bun skill-refactor.ts split ffuf --confirm');
    log(colors.dim, '  bun skill-refactor.ts validate create-cli');
    process.exit(0);
  }

  switch (command) {
    case 'analyze': {
      const analysis = analyzeSkill(skillName);
      log(colors.cyan, `\n📊 Analysis for ${skillName}:`);
      log(colors.dim, `  Total Lines: ${analysis.totalLines}`);
      log(colors.green, `  Lines to Keep: ${analysis.keepLines}`);
      log(colors.yellow, `  Lines to Extract: ${analysis.extractLines}`);
      log(colors.red, `  Lines Unclear: ${analysis.unclearLines}`);
      log(colors.bright, `\n💡 Recommendation: ${analysis.recommendation}`);

      log(colors.cyan, `\n📋 Sections:`);
      analysis.sections.forEach(section => {
        const icon =
          section.classification === 'keep' ? '✓' :
          section.classification === 'extract' ? '→' : '?';
        const color =
          section.classification === 'keep' ? colors.green :
          section.classification === 'extract' ? colors.yellow : colors.red;
        const lines = section.endLine - section.startLine + 1;
        log(color, `  ${icon} ${section.title} (${lines} lines) - ${section.classification}`);
      });
      break;
    }

    case 'split': {
      splitSkill(skillName, confirm);
      break;
    }

    case 'validate': {
      validateSkill(skillName);
      break;
    }

    default: {
      log(colors.red, `Unknown command: ${command}`);
      process.exit(1);
    }
  }
} catch (error) {
  log(colors.red, `❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
