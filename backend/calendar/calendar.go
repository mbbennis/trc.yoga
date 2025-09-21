package calendar

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"maps"
	"slices"
	"strings"

	ics "github.com/arran4/golang-ical"

	loc "github.com/mbbennis/trc.yoga/backend/location"
	"github.com/mbbennis/trc.yoga/backend/s3"
	"github.com/mbbennis/trc.yoga/backend/utils"
)

func LoadCalendarEvents(locs []loc.Location, getter loc.HTTPGetter) (map[string][]*ics.VEvent, error) {
	eventsMap := make(map[string][]*ics.VEvent, len(locs))

	for _, loc := range locs {
		log.Printf("Getting events for %v", loc.Name)

		events, err := loc.GetYogaEvents(getter)
		if err != nil {
			return nil, err
		}

		eventsMap[loc.ShortName] = events
	}

	return eventsMap, nil
}

func WriteCalendars(ctx context.Context, s3Client *s3.Client, events map[string][]*ics.VEvent, dir string) error {
	keys := slices.Sorted(maps.Keys(events))
	combinations := utils.GenerateCombinations(keys)

	for _, comb := range combinations {
		var buf bytes.Buffer

		err := buildCalendar(events, comb).SerializeTo(&buf)
		if err != nil {
			return err
		}

		key := fmt.Sprintf("%s/%s.ical", dir, strings.Join(comb, "_"))
		log.Printf("Writing calendar file: %v", key)

		if err = s3Client.Upload(ctx, buf.Bytes(), key); err != nil {
			return err
		}
	}

	return nil
}

func buildCalendar(events map[string][]*ics.VEvent, locations []string) *ics.Calendar {
	calendar := ics.NewCalendar()
	calendar.SetXWRCalName("Triangle Rock Club Yoga")

	for _, loc := range locations {
		for _, e := range events[loc] {
			calendar.AddVEvent(e)
		}
	}

	return calendar
}
