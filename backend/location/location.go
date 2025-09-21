package location

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	ics "github.com/arran4/golang-ical"

	"github.com/mbbennis/trc.yoga/backend/s3"
	"github.com/mbbennis/trc.yoga/backend/utils"
)

type Location struct {
	Name         string `json:"name"`
	ShortName    string `json:"shortName"`
	Address      string `json:"address"`
	ICalendarURL string `json:"iCalendarUrl"`
}

type HTTPGetter interface {
	Get(url string) (*http.Response, error)
}

func (l Location) GetYogaEvents(getter HTTPGetter) ([]*ics.VEvent, error) {
	cal, err := l.fetchCalendar(getter)
	if err != nil {
		return nil, err
	}

	events := filterForYogaEvents(cal.Events())
	l.enrichEvents(events)

	return events, nil
}

func (l Location) fetchCalendar(getter HTTPGetter) (*ics.Calendar, error) {
	resp, err := getter.Get(l.ICalendarURL)

	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	cleanedBody := utils.CleanLineEndings(resp.Body)

	return ics.ParseCalendar(cleanedBody)
}

func (l Location) enrichEvents(events []*ics.VEvent) {
	for _, e := range events {
		e.AddCategory(l.Name)
		e.SetLocation(l.Address)
	}
}

func LoadLocations(ctx context.Context, s3Client *s3.Client, key string) ([]Location, error) {
	bytes, err := s3Client.Download(ctx, key)
	if err != nil {
		return nil, err
	}

	locs := []Location{}
	if err := json.Unmarshal(bytes, &locs); err != nil {
		return nil, err
	}

	return locs, nil
}

func filterForYogaEvents(events []*ics.VEvent) []*ics.VEvent {
	var result []*ics.VEvent

	for _, e := range events {
		if isYogaEvent(e) {
			result = append(result, e)
		}
	}

	return result
}

func isYogaEvent(event *ics.VEvent) bool {
	const yoga = "yoga"
	var summary, description string

	if event.HasProperty("SUMMARY") {
		summary = strings.ToLower(event.GetProperty("SUMMARY").Value)
	}
	if event.HasProperty("DESCRIPTION") {
		description = strings.ToLower(event.GetProperty("DESCRIPTION").Value)
	}

	return strings.Contains(summary, yoga) || strings.Contains(description, yoga)
}
