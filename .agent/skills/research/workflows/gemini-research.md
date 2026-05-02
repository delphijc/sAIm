#!/usr/bin/env bun

/**
 * # Gemini Web Research Command - Intelligent Multi-Query Google Search
 *
 * This command analyzes your research question, decomposes it into 4-8 targeted
 * sub-queries, and executes them in parallel using gemini-researcher agents with
 * integrated Google Search grounding.
 * 
 * ## Usage
 * ```bash
 * bun ${PAI_DIR}/Commands/perform-gemini-research.md "your complex research question here"
 * ```
 *
 * ## Features
 * - Intelligent query decomposition into multiple focused searches
 * - Parallel execution via gemini-researcher agents for speed
 * - Google Search grounding for real-time web data integration
 * - Iterative follow-up searches based on initial findings
 * - Comprehensive synthesis of all findings
 * 
 * ## Models
 * - **gemini-2.0-flash** - Fast, optimized for search integration (default)
 * - **gemini-2.0-flash-thinking-exp** - Deep reasoning for complex analysis
 * - Uses Google Search API for real-time web grounding
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const exec = promisify(require('child_process').exec);

// Load .env file from ~/.claude directory
function loadEnv() {
  const envPath = path.join(os.homedir(), '.claude', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
  }
}

// Load environment variables
loadEnv();

// Get the research question from command line
const originalQuestion = process.argv.slice(2).join(' ');

if (!originalQuestion) {
  console.error('❌ Please provide a research question');
  console.error('Usage: bun ${PAI_DIR}/Commands/perform-gemini-research.md "your question here"');
  process.exit(1);
}

// Load API keys from environment
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.error('❌ GOOGLE_API_KEY not found');
  console.error('Please add GOOGLE_API_KEY to your ${PAI_DIR}/.env file');
  process.exit(1);
}

console.log('📅 ' + new Date().toISOString());
console.log('\n📋 SUMMARY: Intelligent web research with query decomposition via Gemini\n');
console.log('🔍 ANALYSIS: Analyzing your question to generate targeted queries...\n');
console.log('Original question:', originalQuestion);
console.log('\n⚡ ACTIONS: Decomposing into sub-queries...\n');

// Function to analyze question and generate sub-queries using Gemini
async function decomposeQuestion(question: string): Promise<string[]> {
  const analysisPrompt = `Analyze this research question and decompose it into 4-8 focused sub-queries for comprehensive research:

"${question}"

Consider:
1. Different aspects/angles of the topic
2. Background/context queries
3. Current state/recent developments
4. Comparisons/alternatives
5. Technical details if relevant
6. Implications/consequences
7. Expert opinions/analysis
8. Data/statistics if relevant

Return ONLY a JSON array of query strings, no explanation.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': googleApiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: analysisPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95
        }
      })
    });

    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback: create basic queries if parsing fails
    return [
      question,
      `latest news about ${question}`,
      `technical details ${question}`,
      `expert analysis ${question}`
    ];
  } catch (error) {
    console.error('Failed to decompose question, using fallback queries');
    return [
      question,
      `current state of ${question}`,
      `recent developments in ${question}`,
      `analysis of ${question}`
    ];
  }
}

// Function to execute a single search query using Gemini with Google Search grounding
async function executeSearch(query: string, useThinking: boolean = false): Promise<any> {
  const model = useThinking ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash';
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': googleApiKey
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{
          text: query
        }]
      }],
      tools: [{
        googleSearch: {}
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95
      }
    })
  });

  return response.json();
}

// Function to run gemini-researcher agent for a query
async function runResearcherAgent(query: string, index: number): Promise<string> {
  return new Promise((resolve) => {
    console.log(`🔍 Agent ${index + 1}: Researching "${query}"`);

    const agentPrompt = `
[VOICE CONFIG - MANDATORY]
Follow your agents/gemini-researcher.md configuration:
- Use [AGENT:gemini-researcher] tag in COMPLETED section
- Your voice ID: as configured in agent definition
- Follow your specified output format

[TASK]
Research the following query using Gemini with Google Search integration and provide comprehensive findings:
"${query}"

Use the web-research capabilities to search for current information.
Focus on finding authoritative, recent, and relevant information.
Synthesize your findings clearly and concisely.
Include source citations from your search results.
`;

    // Simulate agent task execution (in real implementation, use Task tool)
    executeSearch(query)
      .then(result => {
        const content = result.candidates[0].content.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join('\n');
        
        let output = `\n### Query ${index + 1}: ${query}\n`;
        output += `**Findings:**\n${content}\n`;
        
        // Extract and display search results if available
        const searchResults = result.candidates[0].content.parts
          .filter((part: any) => part.toolUseBlock?.toolUseId === 'google_search');
        
        if (searchResults.length > 0) {
          output += `\n**Search Results Used:**\n`;
          output += `- Integrated Google Search results for comprehensive grounding\n`;
        }
        
        resolve(output);
      })
      .catch(error => {
        resolve(`\n### Query ${index + 1}: ${query}\n**Error:** ${error.message}\n`);
      });
  });
}

// Main execution
(async () => {
  try {
    // Step 1: Decompose the question
    const subQueries = await decomposeQuestion(originalQuestion);
    console.log(`Generated ${subQueries.length} targeted queries:\n`);
    subQueries.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    
    console.log('\n✅ RESULTS: Executing parallel research with Google Search grounding...\n');
    console.log('═'.repeat(60));
    
    // Step 2: Execute all queries in parallel
    const searchPromises = subQueries.map((query, index) => 
      runResearcherAgent(query, index)
    );
    
    const results = await Promise.all(searchPromises);
    
    // Step 3: Display all results
    results.forEach(result => console.log(result));
    
    console.log('═'.repeat(60));
    
    // Step 4: Determine if follow-up searches are needed
    console.log('\n📊 STATUS: Analyzing if follow-up searches are needed...\n');
    
    // Simple heuristic: if original question mentions "latest" or recent years, do a follow-up
    if (originalQuestion.match(/latest|recent|2024|2025|2026|current|today|now/i)) {
      console.log('➡️ NEXT: Executing follow-up search for most recent information...\n');
      
      const followUpQuery = `Most recent updates and developments as of ${new Date().toLocaleDateString()} regarding: ${originalQuestion}`;
      const followUpResult = await executeSearch(followUpQuery, true);
      
      console.log('### Follow-up Search: Latest Updates');
      const followUpContent = followUpResult.candidates[0].content.parts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .join('\n');
      console.log(followUpContent);
      console.log('\n');
    }
    
    // Step 5: Final synthesis
    console.log('\n🎯 COMPLETED: Completed multi-query intelligent web research with Gemini + Google Search integration.');
    
  } catch (error) {
    console.error('❌ Error during research:', error);
    process.exit(1);
  }
})();
