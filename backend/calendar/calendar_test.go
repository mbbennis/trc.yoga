package calendar

import (
	"context"
	"errors"
	"testing"

	ics "github.com/arran4/golang-ical"

	"github.com/mbbennis/trc.yoga/backend/internal/mock"
	loc "github.com/mbbennis/trc.yoga/backend/location"
	"github.com/mbbennis/trc.yoga/backend/s3"
)

const dummyICal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test Calendar//EN
BEGIN:VEVENT
UID:1
SUMMARY:Morning Yoga
DTSTART:20250921T080000Z
DTEND:20250921T090000Z
DESCRIPTION:A relaxing yoga class
END:VEVENT
BEGIN:VEVENT
UID:2
SUMMARY:Spin Class
DTSTART:20250921T100000Z
DTEND:20250921T110000Z
DESCRIPTION:High intensity spin
END:VEVENT
END:VCALENDAR`

func dummyEvent(summary string) *ics.VEvent {
	c := ics.NewCalendar()
	e := c.AddEvent("id")
	e.SetSummary(summary)
	return e
}

func TestLoadCalendarEvents_Success(t *testing.T) {
	locs := []loc.Location{
		loc.Location{Name: "Studio A", ShortName: "A", Address: "123 Main St", ICalendarURL: "http://example.com/a.ics"},
	}

	mockGet := &mock.MockHTTPClient{Data: []byte(dummyICal)}
	eventsMap, err := LoadCalendarEvents(locs, mockGet)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(eventsMap) != 1 {
		t.Errorf("expected 1 keys, got %d", len(eventsMap))
	}

	if len(eventsMap["A"]) != 1 || eventsMap["A"][0].GetProperty(ics.ComponentPropertySummary).Value != "Morning Yoga" {
		t.Errorf("unexpected events for A: %+v", eventsMap["A"])
	}
}

func TestLoadCalendarEvents_Error(t *testing.T) {
	locs := []loc.Location{
		loc.Location{Name: "Studio A", ShortName: "A"},
	}

	mockGet := &mock.MockHTTPClient{Err: errors.New("http error")}
	_, err := LoadCalendarEvents(locs, mockGet)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestWriteCalendars_Success(t *testing.T) {
	ctx := context.Background()
	mockUp := &mock.MockUploader{}
	mockS3 := &s3.Client{Uploader: mockUp}

	events := map[string][]*ics.VEvent{
		"A": {dummyEvent("Morning Yoga")},
		"B": {dummyEvent("Acro Yoga")},
	}

	dir := "calendars"

	err := WriteCalendars(ctx, mockS3, events, dir)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if mockUp.Count != 3 {
		t.Errorf("expected 3 uploads, got %d", mockUp.Count)
	}
}

func TestWriteCalendars_S3Error(t *testing.T) {
	ctx := context.Background()
	mockUp := &mock.MockUploader{Err: errors.New("s3 error")}
	mockS3 := &s3.Client{Uploader: mockUp}

	events := map[string][]*ics.VEvent{
		"A": {dummyEvent("Yoga1")},
	}

	err := WriteCalendars(ctx, mockS3, events, "calendars")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}
