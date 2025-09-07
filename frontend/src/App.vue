<script setup>
import { ref } from "vue";
import locations from "@/assets/locations.json";
import Calendar from "@/components/Calendar.vue"
import CopyCalendarLink from "@/components/CopyCalendarLink.vue";
import LocationFilter from "@/components/LocationFilter.vue"

const filteredLocations = ref([]);
</script>
<template>
    <header>
        <img alt="Tree yoga pose" class="logo" src="./assets/yoga.svg" width="125" height="125" />
        <div class="wrapper">
            <h1 class="green">TRC Yoga</h1>
            <h3>See all of the yoga schedules in one place.</h3>
            <LocationFilter :locations=locations @update-filter="val => filteredLocations = val" />
            <CopyCalendarLink :locations=filteredLocations />
        </div>
    </header>
    <main>
        <Calendar :locations=filteredLocations />
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
