<script setup lang="ts">
import { ref } from 'vue';

import CopyCalendarLink from '@/components/CopyCalendarLink.vue';
import EventCalendar from '@/components/EventCalendar.vue';
import LocationFilter from '@/components/LocationFilter.vue';

import { locationService } from './services/BundledLocationService';

const locations = locationService.getLocations();
const filteredLocations = ref([]);
</script>
<template>
    <header>
        <img
            alt="Tree yoga pose"
            class="logo"
            src="./assets/yoga.svg"
            width="125"
            height="125"
        />
        <div class="header-content">
            <h1 class="green">TRC Yoga</h1>
            <p>See all of the yoga schedules.</p>
            <div class="select-wrapper">
                <LocationFilter
                    :locations="locations"
                    @update-filter="(val) => (filteredLocations = val)"
                />
                <CopyCalendarLink :locations="filteredLocations" />
            </div>
        </div>
    </header>
    <main>
        <EventCalendar :locations="filteredLocations" />
    </main>
</template>
<style scoped>
header {
    line-height: 1.5;
    padding-bottom: 1rem;
}

h1 {
    font-weight: 500;
    font-size: 2.6rem;
    position: relative;
    top: -10px;
    text-align: center;
}

p {
    text-align: center;
}

.logo {
    display: block;
    margin: 0 auto 2rem;
}

.select-wrapper {
    margin-top: 1rem;
}

@media (min-width: 1024px) {
    header {
        display: flex;
        place-items: center;
        padding-right: calc(var(--section-gap) / 2);
    }

    h1,
    h3 {
        text-align: left;
    }

    .logo {
        margin: 0 2rem 0 0;
    }

    .header-content {
        display: flex;
        place-items: flex-start;
        flex-wrap: wrap;
    }
}
</style>
