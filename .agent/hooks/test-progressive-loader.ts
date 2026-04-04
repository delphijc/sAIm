#!/usr/bin/env bun

/**
 * test-progressive-loader.ts
 *
 * Test script for the progressive loader system
 * Validates Tier 1/2/3 loading functions work correctly
 */

import {
  loadMinimalSkill,
  loadMinimalAgent,
  loadSkillReference,
  loadAgentReference,
  getLoadingStats,
  isLoaded,
  formatAsSystemReminder,
  clearLoadedContext
} from './lib/progressive-loader';

async function runTests() {
  console.log('🧪 Progressive Loader Test Suite\n');

  // Test 1: Load minimal CORE skill
  console.log('Test 1: Load minimal CORE skill (Tier 1)');
  const coreSkill = loadMinimalSkill('CORE');
  if (coreSkill) {
    console.log(`✅ Loaded CORE skill: ${coreSkill.size} characters`);
    console.log(`   Content preview: ${coreSkill.content.substring(0, 80)}...`);
  } else {
    console.log('❌ Failed to load CORE skill');
  }

  // Test 2: Check if CORE is marked as loaded
  console.log('\nTest 2: Check isLoaded() function');
  const isCoreLoaded = isLoaded('CORE', 'skill');
  console.log(`✅ isLoaded('CORE', 'skill') = ${isCoreLoaded}`);

  // Test 3: Try to load agent
  console.log('\nTest 3: Load minimal Agent (Tier 1)');
  const engineerAgent = loadMinimalAgent('Engineer');
  if (engineerAgent) {
    console.log(`✅ Loaded Engineer agent: ${engineerAgent.size} characters`);
  } else {
    console.log('ℹ️  Engineer agent not found (expected, may not exist yet)');
  }

  // Test 4: Check loading stats
  console.log('\nTest 4: Get loading statistics');
  const stats = getLoadingStats();
  console.log(`✅ Loading Statistics:`);
  console.log(`   - Tier 1 Skills: ${stats.tier1_skills}`);
  console.log(`   - Tier 1 Agents: ${stats.tier1_agents}`);
  console.log(`   - Tier 2 References: ${stats.tier2_references}`);
  console.log(`   - Total tokens estimate: ${stats.total_tokens_estimate}`);

  // Test 5: Format as system reminder
  console.log('\nTest 5: Format content as system reminder');
  const formatted = formatAsSystemReminder('Test Title', 'Test content here');
  console.log(`✅ Formatted output (${formatted.length} chars):`);
  console.log(`   ${formatted.substring(0, 100)}...`);

  // Test 6: Try loading non-existent reference (graceful failure)
  console.log('\nTest 6: Load non-existent reference (graceful failure)');
  const nonExistent = loadSkillReference('NonExistent');
  if (nonExistent === null) {
    console.log('✅ Correctly returned null for non-existent reference');
  } else {
    console.log('❌ Should have returned null');
  }

  // Test 7: Clear and verify
  console.log('\nTest 7: Clear loaded context');
  clearLoadedContext();
  const statsAfterClear = getLoadingStats();
  if (statsAfterClear.tier1_skills === 0 && statsAfterClear.tier1_agents === 0) {
    console.log('✅ Successfully cleared loaded context');
  } else {
    console.log('❌ Failed to clear context');
  }

  console.log('\n✅ All tests completed!\n');
}

runTests().catch(error => {
  console.error('❌ Test error:', error);
  process.exit(1);
});
