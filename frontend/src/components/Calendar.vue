<script setup>
import { ref, watch } from 'vue';
import {
    createCalendar,
    createViewDay,
    createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createEventModalPlugin } from '@schedule-x/event-modal';
import { ScheduleXCalendar } from '@schedule-x/vue';
import '@schedule-x/theme-default/dist/index.css';
import EventDetails from "@/components/EventDetails.vue"

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
    events: {
        type: Array,
        required: true,
    }
});
const eventsServicePlugin = createEventsServicePlugin();
// const eventModal = createEventModalPlugin();

const eventDetailsRef = ref(null);

const onEventClick = (calendarEvent) => {
    console.log('matt was here');
    console.log(calendarEvent);
    eventDetailsRef.value.showEvent(calendarEvent);
}

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
            onEventClick: onEventClick,
        },
    },
    // [eventsServicePlugin, eventModal],
    [eventsServicePlugin],
);

watch(() => props.events, (newEvents, _) => eventsServicePlugin.set(newEvents));

</script>
<template>
    <div class="calendar-container">
        <ScheduleXCalendar :calendar-app="calendar" />
        <i>Calendar will not reflect last minute cancellations.</i>
        <EventDetails ref="eventDetailsRef"></EventDetails>
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