<script setup lang="ts">
import '@schedule-x/theme-default/dist/index.css';

import {
    CalendarEvent,
    createCalendar,
    createViewDay,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { ScheduleXCalendar } from '@schedule-x/vue';
import { computed, onMounted, PropType, ref, watch } from 'vue';

import colors from '@/assets/calendar-colors.json';
import EventDetails from '@/components/EventDetails.vue';
import { fetchCalendarEvents } from '@/services/EventService';
import { Location } from '@/types/Location';

const props = defineProps({
    locations: {
        type: Array as PropType<Location[]>,
        required: true,
    },
});

const events = ref<CalendarEvent[]>([]);
const selectedEventDetails = ref();
const eventsServicePlugin = createEventsServicePlugin();

onMounted(async () => {
    events.value = await fetchCalendarEvents();
});

const filteredEvents = computed(() => {
    const addresses = props.locations.map((l) => l.address);
    return events.value.filter((event) => {
        return event.location && addresses.includes(event.location);
    });
});

watch(filteredEvents, (newEvents) => {
    eventsServicePlugin.set(newEvents);
});

const calendar = createCalendar(
    {
        views: [createViewDay()],
        isDark: true,
        calendars: colors,
        dayBoundaries: {
            start: '06:00',
            end: '21:00',
        },
        callbacks: {
            onEventClick: (event) =>
                selectedEventDetails.value.showEvent(event),
        },
    },
    [eventsServicePlugin],
);
</script>
<template>
    <div class="calendar-container">
        <ScheduleXCalendar :calendar-app="calendar" />
        <i>Calendar won't reflect last minute cancellations.</i>
        <EventDetails ref="selectedEventDetails" />
    </div>
</template>
<style>
.calendar-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.sx-vue-calendar-wrapper {
    width: 100%;
    max-width: 80vw;
    height: 800px;
    max-height: 90vh;
    overflow-y: auto;
}
</style>
