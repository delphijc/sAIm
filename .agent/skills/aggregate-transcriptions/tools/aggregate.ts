import * as fs from 'fs';
import * as path from 'path';

const TRANSCRIPTIONS_DIR = path.join(process.env.HOME || '', '$HOME/Projects/sam/.claude/History/TranscribedAudio');
const OUTPUT_FILE = path.join(TRANSCRIPTIONS_DIR, 'FollowUps.md'); // TitleCase output

interface Insight {
  filename: string;
  content: string;
}

interface ActionItem {
  filename: string;
  content: string;
}

function extractSection(content: string, startHeader: string, endPatterns: string[]): string | null {
  const lines = content.split('\n');
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startHeader)) {
      startIndex = i;
      // Skip the header line itself
      break;
    }
  }

  if (startIndex === -1) return null;

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (endPatterns.some(pattern => line.startsWith(pattern) || line.includes(pattern))) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) endIndex = lines.length;

  // Extract content and clean up
  return lines.slice(startIndex + 1, endIndex).join('\n').trim();
}

function parseFile(filepath: string): { keyInsights: string | null, actionItems: string | null } {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    
    // Extract Key Insights
    // Starts with "## 💡 Key Insights (The "Wisdom")" and ends before "## 📝 Processed Transcript" or other sections
    const keyInsights = extractSection(content, '## 💡 Key Insights (The "Wisdom")', ['## 📝', '## 🛠️', '## 🔗', '## Processed Transcript', ' Actionable Items']);

    // Extract Actionable Items
    // Starts with "## 🛠️ Actionable Items & Frameworks" and ends before "## 🔗 Related Concepts" or EOF
    const actionItems = extractSection(content, '## 🛠️ Actionable Items & Frameworks', ['## 🔗', '## Related Concepts', '## 📝']);

    return { keyInsights, actionItems };
  } catch (error) {
    console.error(`Error reading file ${filepath}:`, error);
    return { keyInsights: null, actionItems: null };
  }
}

async function main() {
  console.log(`Scanning directory: ${TRANSCRIPTIONS_DIR}`);
  
  if (!fs.existsSync(TRANSCRIPTIONS_DIR)) {
    console.error(`Directory not found: ${TRANSCRIPTIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRANSCRIPTIONS_DIR).filter(file => 
    file.endsWith('.md') && 
    file !== 'followups.md' && 
    file !== 'FollowUps.md' &&
    !file.startsWith('._') // Ignore macOS hidden files
  );

  const keyInsightsList: Insight[] = [];
  const actionItemsList: ActionItem[] = [];

  for (const file of files) {
    const { keyInsights, actionItems } = parseFile(path.join(TRANSCRIPTIONS_DIR, file));
    
    if (keyInsights) {
        keyInsightsList.push({ filename: file, content: keyInsights });
    }
    if (actionItems) {
        actionItemsList.push({ filename: file, content: actionItems });
    }
  }

  // Generate Markdown
  let output = '# Aggregated Follow-ups\n\n';

  output += '## 💡 Key Insights Aggregation\n\n';
  if (keyInsightsList.length === 0) {
    output += '_No key insights found._\n\n';
  } else {
    for (const item of keyInsightsList) {
        output += `### [${item.filename}](${item.filename})\n\n`;
        output += `${item.content}\n\n`;
        output += `\n\n---\n\n`;
    }
  }

  output += '\n## 🛠️ Actionable Items Aggregation\n\n';
  if (actionItemsList.length === 0) {
    output += '_No actionable items found._\n\n';
  } else {
    for (const item of actionItemsList) {
        output += `### [${item.filename}](${item.filename})\n\n`;
        output += `${item.content}\n\n`;
        output += `\n\n---\n\n`;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Successfully wrote aggregated content to ${OUTPUT_FILE}`);
}

main().catch(console.error);
