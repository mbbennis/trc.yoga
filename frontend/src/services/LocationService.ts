import { Location } from '@/types/Location';

class LocationService {
    private cache: Location[] | null = null;
    private cacheMap: Map<string, Location> | null = null;
    private cachePromise: Promise<Location[]> | null = null;

    async getLocations(): Promise<Location[]> {
        if (this.cache) return this.cache;
        if (this.cachePromise) return this.cachePromise;

        this.cachePromise = fetch('/data/locations.json')
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to fetch locations');
                const data: Location[] = await res.json();
                this.cache = data;
                this.cacheMap = new Map(data.map((loc) => [loc.address, loc]));
                return data;
            })
            .catch((err) => {
                console.error(err);
                return [];
            })
            .finally(() => {
                this.cachePromise = null;
            });

        return this.cachePromise;
    }

    async getLocationByAddress(address: string): Promise<Location | undefined> {
        if (!this.cache) await this.getLocations();
        return this.cacheMap?.get(address);
    }
}

export const locationService = new LocationService();
