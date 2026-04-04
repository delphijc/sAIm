<template>
  <div
    class="context-widget flex items-center gap-2 px-3 py-1 rounded-lg text-sm flex-shrink-0"
    :title="`Total: ${totalContext} | Used: ${usedContext} | Available: ${availableContext}`"
  >
    <!-- Brain icon -->
    <Brain :size="14" class="text-[#bb9af7] flex-shrink-0" />

    <!-- Usage bar (mini visualization) -->
    <div class="usage-bar">
      <div class="usage-fill" :style="{ width: usagePercentage + '%' }"></div>
    </div>

    <!-- Text display -->
    <span class="font-medium text-[#bb9af7] whitespace-nowrap">
      {{ formatNumber(usedContext) }}<span class="text-[var(--theme-text-quaternary)]">/{{ formatNumber(totalContext) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Brain } from 'lucide-vue-next';
import type { HookEvent } from '../../types';

interface Props {
  events: HookEvent[];
}

const props = defineProps<Props>();

// Constants
const MAX_CONTEXT = 200000; // Claude Haiku 4.5 context window (200K)

// State
const totalContext = ref(MAX_CONTEXT);
const usedContext = ref(0);

// Computed
const availableContext = computed(() => totalContext.value - usedContext.value);
const usagePercentage = computed(() => Math.min(100, (usedContext.value / totalContext.value) * 100));

// Calculate context usage from events
function calculateContextUsage(events: HookEvent[]): number {
  let total = 0;

  events.forEach(event => {
    // Try to extract tokens from various payload locations

    // Check direct token count in payload
    if (event.payload?.tokens) {
      if (typeof event.payload.tokens === 'number') {
        total += event.payload.tokens;
      } else if (typeof event.payload.tokens === 'object') {
        const input = event.payload.tokens.input || 0;
        const output = event.payload.tokens.output || 0;
        total += input + output;
      }
    }

    // Check for input/output tokens at payload level
    if (event.payload?.input_tokens) {
      total += event.payload.input_tokens;
    }
    if (event.payload?.output_tokens) {
      total += event.payload.output_tokens;
    }

    // Estimate from message content
    if (typeof event.payload?.message === 'string') {
      // Rough estimate: ~1 token per 4 characters
      total += Math.ceil(event.payload.message.length / 4);
    }

    // If event has a chat array, estimate ~150 tokens per exchange
    if (Array.isArray(event.chat)) {
      total += event.chat.length * 150;
    }
  });

  return total;
}

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Watch for event changes
watch(() => props.events, (newEvents) => {
  usedContext.value = calculateContextUsage(newEvents);
}, { deep: true });

// Initial calculation
if (props.events.length > 0) {
  usedContext.value = calculateContextUsage(props.events);
}
</script>

<style scoped>
.context-widget {
  background-color: rgba(187, 154, 247, 0.15);
  border: 1px solid rgba(187, 154, 247, 0.2);
  transition: all 0.3s ease;
}

.context-widget:hover {
  background-color: rgba(187, 154, 247, 0.2);
  border-color: rgba(187, 154, 247, 0.3);
}

.usage-bar {
  width: 40px;
  height: 4px;
  background: rgba(187, 154, 247, 0.2);
  border-radius: 2px;
  overflow: hidden;
  flex-shrink: 0;
}

.usage-fill {
  height: 100%;
  background: linear-gradient(90deg, #bb9af7 0%, #f7768e 100%);
  transition: width 0.3s ease;
  border-radius: 2px;
}
</style>
