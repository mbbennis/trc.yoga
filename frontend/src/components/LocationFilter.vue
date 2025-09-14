<script setup lang="ts">
import { PropType, shallowRef, watch } from 'vue';

import { Location } from '@/types/Location';

const props = defineProps({
    locations: {
        type: Array as PropType<Location[]>,
        required: true,
    },
});
const emit = defineEmits(['updateFilter']);
const selection = shallowRef([]);

watch(selection, (newSelection) => {
    const selectedLocations = newSelection.map((idx) => props.locations[idx]);
    emit('updateFilter', selectedLocations);
});
</script>
<template>
    <h3>Select locations</h3>
    <div class="d-flex justify-center">
        <v-chip-group v-model="selection" class="chip-group" column multiple>
            <v-chip
                v-for="location in locations"
                :key="location.name"
                :color="location.color"
                variant="outlined"
                filter
            >
                {{ location.mediumName }}
            </v-chip>
        </v-chip-group>
    </div>
</template>
<style scoped>
h3 {
    font-size: 1.2rem;
    text-align: center;
}

@media (max-width: 512px) {
    .chip-group {
        margin-left: 15%;
    }
}

@media (min-width: 1024px) {
    h3 {
        text-align: left;
    }
}
</style>
