<script setup>
import { computed } from 'vue';

import { getICalendarUrl } from '@/services/EventService.js';

const props = defineProps({
    locations: {
        type: Array,
        required: true,
    },
});
const isDisabled = computed(() => props.locations.length === 0);

function copyLink() {
    const url = getICalendarUrl(props.locations.map((l) => l.shortName));
    navigator.clipboard
        .writeText(url)
        .catch((err) => console.error('Failed to copy: ', err));
}
</script>
<template>
    <div class="d-flex justify-center">
        <v-btn
            v-ripple
            color="primary"
            rounded="lg"
            prepend-icon="mdi-content-copy"
            :disabled="isDisabled"
            @click="copyLink"
        >
            Copy iCal Link
        </v-btn>
    </div>
</template>
