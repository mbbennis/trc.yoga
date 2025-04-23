<script setup>
import { cleanDescription } from '@/services/EventService';
import { ref } from 'vue';

// const dialog = ref(false);
const dialog = ref(true);

const showEvent = (event) => {
    eventData.value = event;
    dialog.value = true;
};

const eventData = ref({
    title: 'Power Yoga',
    location: '2330 Salvage Yard Dr, Raleigh, NC 27604',
    gymName: 'lskdjf',
    person: 'joe',
    start: '2025-04-22 18:00',
    end: '2025-04-22 19:00',
    description: cleanDescription("Core works strictly on your hip flexors, abdominal region, lower back, and obliques.&amp;nbsp;In this class, we focus on the powerhouse of your body. A strong core is essential for climbers, so make sure it gets the work it deserves! We throw in a little balance too, to make sure you&amp;rsquo;re ready for whatever may come your way. 20 minutes.&amp;nbsp;Cost: Free for members | $27 day pass for non-members*If you make a reservation and find you are unable to attend, please cancel your reservation through RGP or call the front desk at (919) 910-7222."),
    calendarUrl: 'https://google.com',
});
// const eventData = ref({});

function formatTime() {
    const start = new Date(eventData.value.start.replace(" ", "T"));
    const end = new Date(eventData.value.end.replace(" ", "T"));

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

defineExpose({
    showEvent,
});
</script>
<template>
    <v-dialog v-model="dialog" max-width="500">
        <v-card>
            <v-card-item>
                <v-card-title>{{ eventData.title }}</v-card-title>
                <v-card-subtitle>{{ eventData.gymName }}</v-card-subtitle>
            </v-card-item>

            <v-card-text>
                <div class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-clock-outline</v-icon>
                    <span class="text-subtitle-1">{{ formatTime() }}</span>
                </div>
                <div class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-map-marker-outline</v-icon>
                    <span class="text-subtitle-1">{{ eventData.location }}</span>
                </div>
                <div class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-account-outline</v-icon>
                    <span class="text-subtitle-1">{{ eventData.person }}</span>
                </div>
                <div class="d-flex align-start">
                    <v-icon class="mt-1 mr-2" color="primary">mdi-card-text-outline</v-icon>
                    <span class="text-subtitle-1">{{ eventData.description }}</span>
                </div>
            <!-- <v-text-field v-model="eventData.title" label="Event Title" /> -->
            <!-- <v-text-field v-model="eventData.location" label="Location" />
            <v-text-field v-model="eventData.start" label="Start Time" /> -->
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :href="eventData.calendarUrl" target="_blank">Register</v-btn>
                <v-btn text @click="dialog = false">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
