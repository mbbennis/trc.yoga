<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
    createCalendar,
    createViewDay,
    createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { ScheduleXCalendar } from '@schedule-x/vue';
import '@schedule-x/theme-default/dist/index.css';
import EventDetails from "@/components/EventDetails.vue"
import { fetchCalendarEvents } from '@/services/EventService';

const colors = {
    NR: {
        colorName: 'NR',
        lightColors: {
            main: '#f9d71c',
            container: '#fff5aa',
            onContainer: '#594800',
        },
        darkColors: {
            main: '#fff5c0',
            onContainer: '#fff5de',
            container: '#a29742',
        },
    },
    SY: {
        colorName: 'SY',
        lightColors: {
            main: '#f91c45',
            container: '#ffd2dc',
            onContainer: '#59000d',
        },
        darkColors: {
            main: '#ffc0cc',
            onContainer: '#ffdee6',
            container: '#a24258',
        },
    },
    D: {
        colorName: 'D',
        lightColors: {
            main: '#1cf9b0',
            container: '#dafff0',
            onContainer: '#004d3d',
        },
        darkColors: {
            main: '#c0fff5',
            onContainer: '#e6fff5',
            container: '#42a297',
        },
    },
    MV: {
        colorName: 'MV',
        lightColors: {
            main: '#1c7df9',
            container: '#d2e7ff',
            onContainer: '#002859',
        },
        darkColors: {
            main: '#c0dfff',
            onContainer: '#dee6ff',
            container: '#426aa2',
        },
    },
};

const props = defineProps({
    locations: {
        type: Array,
        required: true,
    }
});

const events = ref([]);
const selectedEventDetails = ref();
const eventsServicePlugin = createEventsServicePlugin();

onMounted(async () => {
    events.value = await fetchCalendarEvents();
})

const filteredEvents = computed(() => {
    const addresses = props.locations.map(l => l.address);
    return events.value.filter(event => {
        return addresses.includes(event.location);
    });
});

watch(filteredEvents, (newEvents) => {
    eventsServicePlugin.set(newEvents);
});

const calendar = createCalendar(
    { 
        views: [createViewDay(), createViewWeek()],
        isDark: true,
        calendars: colors,
        dayBoundaries: {
            start: '06:00',
            end: '21:00',
        },
        callbacks: {
            onEventClick: (event) => selectedEventDetails.value.showEvent(event),
        },
    },
    [eventsServicePlugin],
);
</script>
<template>
    <div class="calendar-container">
        <ScheduleXCalendar :calendar-app="calendar" />
        <i>Calendar won't reflect last minute cancellations.</i>
        <EventDetails ref="selectedEventDetails"></EventDetails>
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