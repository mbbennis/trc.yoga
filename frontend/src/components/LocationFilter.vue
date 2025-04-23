<script setup>
import { shallowRef, watch } from 'vue';

const props = defineProps({
    locations: {
        type: Array,
        required: true,
    },
})
const emit = defineEmits();
const selection = shallowRef([]);

watch(selection, (newSelection) => {
    const selectedLocations = newSelection.map(idx => props.locations[idx]);
    emit("update-filter", selectedLocations)
});
</script>
<template>
    <div class="header">
        <div class="locations">
            <h3>Select locations</h3>
            <div class="d-flex justify-center">
                <v-chip-group v-model="selection" column multiple>
                    <v-chip v-for="location in locations" variant="outlined" :color="location.color" filter>
                        {{ location.mediumName }}
                    </v-chip>
                </v-chip-group>
            </div>
        </div>
    </div>
</template>
<style scoped>
h3 {
    font-size: 1.2rem;
    text-align: center;
}

.locations {
    padding-top: 10px;
}

.location v-chip-group {
    position: relative;
    justify-content: center;
}

@media (min-width: 1024px) {
    h3 {
        text-align: left;
    }
}
</style>
