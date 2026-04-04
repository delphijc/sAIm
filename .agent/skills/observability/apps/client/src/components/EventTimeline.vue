<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col">
    <!-- Intensity Bar - Activity Heat Indicator -->
    <IntensityBar
      v-if="heatLevel"
      :intensity="heatLevel.intensity"
      :color="heatLevel.color"
      :label="heatLevel.label"
      :events-per-minute="eventsPerMinute ?? 0"
      :show-tooltip="true"
      :time-range="timeRange"
      :time-ranges="timeRanges"
      @set-time-range="$emit('setTimeRange', $event)"
    />

    <!-- Scrollable Event List - More breathing room -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto px-5 py-4 mobile:px-3 mobile:py-2"
      @scroll="handleScroll"
    >
      <!-- Column Headers -->
      <div class="flex items-center justify-between gap-3 px-4 py-2 mb-2 text-xs font-medium text-[#565f89] uppercase tracking-wide">
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <span class="w-20">Agent</span>
          <span class="w-24">Hook</span>
          <span class="w-20">Tool</span>
          <span class="flex-1">Details</span>
        </div>
        <span class="w-16 text-right">Time</span>
      </div>
      <TransitionGroup
        name="event"
        tag="div"
        class="space-y-2 mobile:space-y-1.5 divide-y divide-[#565f89]/10"
      >
        <EventRow
          v-for="event in filteredEvents"
          :key="`${event.id}-${event.timestamp}`"
          :event="event"
          :gradient-class="getGradientForSession(event.session_id)"
          :color-class="getColorForSession(event.session_id)"
          :app-gradient-class="getGradientForApp(event.agent_name || event.source_app)"
          :app-color-class="getColorForApp(event.agent_name || event.source_app)"
          :app-hex-color="getHexColorForApp(event.agent_name || event.source_app)"
        />
      </TransitionGroup>

      <!-- Empty State - Modern styling -->
      <div v-if="filteredEvents.length === 0" class="flex flex-col items-center justify-center py-16 mobile:py-10">
        <div class="glass-panel-subtle p-6 rounded-2xl mb-4">
          <Box :size="40" class="text-[var(--theme-text-quaternary)]" />
        </div>
        <p class="text-base mobile:text-sm font-medium text-[var(--theme-text-secondary)] mb-1">No events yet</p>
        <p class="text-sm mobile:text-xs text-[var(--theme-text-quaternary)]">Events will appear here as they stream in</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { HookEvent, TimeRange } from '../types';
import { Box } from 'lucide-vue-next';
import EventRow from './EventRow.vue';
import IntensityBar from './IntensityBar.vue';
import { useEventColors } from '../composables/useEventColors';

const props = defineProps<{
  events: HookEvent[];
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
  stickToBottom: boolean;
  uniqueAppNames?: string[]; // Agent IDs (app:session) active in current time window
  allAppNames?: string[]; // All agent IDs (app:session) ever seen in session
  heatLevel?: { intensity: number; color: string; label: string };
  agentCounts?: Record<string, number>; // Count of instances per agent type
  eventsPerMinute?: number; // Events per minute for heat bar display
  timeRange?: TimeRange; // Current time range
  timeRanges?: TimeRange[]; // Available time ranges
}>();

const emit = defineEmits<{
  'update:stickToBottom': [value: boolean];
  selectAgent: [agentName: string];
  setTimeRange: [range: TimeRange];
}>();

const scrollContainer = ref<HTMLElement>();
const { getGradientForSession, getColorForSession, getGradientForApp, getColorForApp, getHexColorForApp } = useEventColors();

// Stable list of app names - only grows, never shrinks (prevents flashing)


// Stable app names - accumulates all seen apps, sorted alphabetically


const filteredEvents = computed(() => {
  const filtered = props.events.filter(event => {
    if (props.filters.sourceApp && event.source_app !== props.filters.sourceApp) {
      return false;
    }
    if (props.filters.sessionId && event.session_id !== props.filters.sessionId) {
      return false;
    }
    if (props.filters.eventType && event.hook_event_type !== props.filters.eventType) {
      return false;
    }
    return true;
  });

  // Reverse array so newest events appear at top
  return filtered.slice().reverse();
});

const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  }
};

const handleScroll = () => {
  if (!scrollContainer.value) return;

  const { scrollTop } = scrollContainer.value;
  const isAtTop = scrollTop < 50;

  if (isAtTop !== props.stickToBottom) {
    emit('update:stickToBottom', isAtTop);
  }
};

watch(() => props.events.length, async () => {
  if (props.stickToBottom) {
    await nextTick();
    scrollToTop();
  }
});

watch(() => props.stickToBottom, (shouldStick) => {
  if (shouldStick) {
    scrollToTop();
  }
});
</script>

<style scoped>
.event-enter-active {
  transition: all 0.3s ease;
}

.event-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.event-leave-active {
  transition: all 0.3s ease;
}

.event-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

</style>