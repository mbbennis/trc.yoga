<script setup>
import { ref } from 'vue';

const dialog = ref(false);
const eventData = ref({});

const showEvent = (event) => {
    eventData.value = event;
    dialog.value = true;
};

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

defineExpose({ showEvent });
</script>
<template>
    <v-dialog v-model="dialog" max-width="500">
        <v-card>
            <v-card-item>
                <v-card-title>{{ eventData.title }}</v-card-title>
                <v-card-subtitle>{{ eventData.gymName }}</v-card-subtitle>
            </v-card-item>
            <v-card-text>
                <div class="event-detail">
                    <v-icon class="mr-2" color="primary">mdi-clock-outline</v-icon>
                    <span>{{ formatTime() }}</span>
                </div>
                <div class="event-detail">
                    <v-icon class="mr-2" color="primary">mdi-map-marker-outline</v-icon>
                    <span>{{ eventData.location }}</span>
                </div>
                <div class="event-detail">
                    <v-icon class="mr-2" color="primary">mdi-account-outline</v-icon>
                    <span>{{ eventData.person }}</span>
                </div>
                <div class="event-detail">
                    <v-icon class="mr-2" color="primary">mdi-card-text-outline</v-icon>
                    <span >{{ eventData.description }}</span>
                </div>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn text :href="eventData.calendarUrl" target="_blank">Register</v-btn>
                <v-btn text @click="dialog = false">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<style>
.event-detail {
    align-items: flex-start;
    display: flex;
    padding: 0.25rem;
}
</style>
