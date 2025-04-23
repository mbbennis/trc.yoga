<script setup>
import { computed, ref } from "vue";
import locations from "@/assets/locations.json";
import Calendar from "@/components/Calendar.vue"
import CopyCalendarLink from "@/components/CopyCalendarLink.vue";
import LocationFilter from "@/components/LocationFilter.vue"
import { fetchCalendarEvents, getICalendarUrl } from "@/services/EventService";

const filteredLocations = ref([]);
const events = ref([]);
const filteredEvents = computed(() => {
    const filteredAddresses = filteredLocations.value.map(l => l.address);
    return events.value.filter(event => {
        return filteredAddresses.includes(event.location);
    });
});

function updateFilter(locations) {
    filteredLocations.value = locations;
}

async function fetchEvents() {
    const shortNames = [];
    const selection = [...Array(locations.length).keys()];  // Select all locations
    selection.forEach(idx => shortNames.push(locations[idx].shortName));
    const url = getICalendarUrl(shortNames);
    events.value = await fetchCalendarEvents(url);
}

fetchEvents();
</script>
<template>
    <header>
        <img alt="Tree yoga pose" class="logo" src="./assets/yoga.svg" width="125" height="125" />
        <div class="wrapper">
            <h1 class="green">TRC Yoga Cassia</h1>
            <h3>See all of the yoga schedules in one place.</h3>
            <LocationFilter :locations=locations @update-filter="updateFilter" />
            <CopyCalendarLink :locations=filteredLocations />
        </div>
    </header>
    <main>
        <Calendar :events=filteredEvents />
    </main>
</template>
<style scoped>
header {
    line-height: 1.5;
}

h1 {
    font-weight: 500;
    font-size: 2.6rem;
    position: relative;
    top: -10px;
    text-align: center;
}

h3 {
    font-size: 1.2rem;
    text-align: center;
}

.logo {
    display: block;
    margin: 0 auto 2rem;
}

@media (min-width: 1024px) {
    header {
        display: flex;
        place-items: center;
        padding-right: calc(var(--section-gap) / 2);
    }

    h1, h3 {
        text-align: left;
    }

    .logo {
        margin: 0 2rem 0 0;
    }

    .wrapper {
        display: flex;
        place-items: flex-start;
        flex-wrap: wrap;
    }
}
</style>
