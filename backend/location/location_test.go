package location_test

import (
	"context"
	"errors"
	"testing"

	ics "github.com/arran4/golang-ical"

	"github.com/mbbennis/trc.yoga/backend/internal/mock"
	"github.com/mbbennis/trc.yoga/backend/location"
	"github.com/mbbennis/trc.yoga/backend/s3"
)

func TestLoadLocations_Success(t *testing.T) {
	jsonData := `[{"name":"Studio A","shortName":"A","address":"123 Main St","iCalendarUrl":"http://example.com/cal.ics"}]`
	client := &s3.Client{Downloader: &mock.MockDownloader{Data: []byte(jsonData)}}

	locs, err := location.LoadLocations(context.Background(), client, "dummykey")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(locs) != 1 {
		t.Fatalf("expected 1 location, got %d", len(locs))
	}
	if locs[0].Name != "Studio A" {
		t.Errorf("expected Studio A, got %s", locs[0].Name)
	}
}

func TestLoadLocations_S3Error(t *testing.T) {
	client := &s3.Client{Downloader: &mock.MockDownloader{Err: errors.New("download failed")}}

	_, err := location.LoadLocations(context.Background(), client, "dummykey")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetYogaEvents_Success(t *testing.T) {
	// Create an iCal with one yoga event and one non-yoga event
	cal := ics.NewCalendar()
	e1 := cal.AddEvent("1")
	e1.SetSummary("Morning Yoga")
	e2 := cal.AddEvent("2")
	e2.SetSummary("Spin Class")

	calendarData := cal.Serialize()

	locObj := location.Location{
		Name:         "Studio A",
		ShortName:    "A",
		Address:      "123 Main St",
		ICalendarURL: "http://example.com/cal.ics",
	}

	client := &mock.MockHTTPClient{Data: []byte(calendarData)}

	events, err := locObj.GetYogaEvents(client)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("expected 1 yoga event, got %d", len(events))
	}
	if events[0].GetProperty("SUMMARY").Value != "Morning Yoga" {
		t.Errorf("expected 'Morning Yoga', got %s", events[0].GetProperty("SUMMARY").Value)
	}

	// Check that the event was enriched
	if events[0].GetProperty("LOCATION").Value != locObj.Address {
		t.Errorf("expected enriched address %s, got %s", locObj.Address, events[0].GetProperty("LOCATION").Value)
	}
	if events[0].HasProperty("CATEGORIES") == false {
		t.Errorf("expected event to have category %s", locObj.Name)
	}
}

func TestGetYogaEvents_HTTPError(t *testing.T) {
	locObj := location.Location{
		Name:         "Studio A",
		ShortName:    "A",
		Address:      "123 Main St",
		ICalendarURL: "http://example.com/cal.ics",
	}

	client := &mock.MockHTTPClient{Err: errors.New("http error")}

	_, err := locObj.GetYogaEvents(client)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
