import rawLocations from '@/assets/locations.json';
import { Location } from '@/types/Location';

class BundledLocationService {
    private addressMap: Map<string, Location> | null = null;

    private locations = (rawLocations as Location[]).map((loc) => ({
        name: loc.name,
        mediumName: loc.mediumName,
        shortName: loc.shortName,
        address: loc.address,
        calendarUrl: loc.calendarUrl,
        color: loc.color,
    }));

    getLocations(): Location[] {
        return this.locations;
    }

    getLocationByAddress(address: string): Location | undefined {
        if (!this.addressMap) {
            this.addressMap = new Map(
                this.getLocations().map((loc) => [loc.address, loc]),
            );
        }
        return this.addressMap.get(address);
    }
}

export const locationService = new BundledLocationService();
