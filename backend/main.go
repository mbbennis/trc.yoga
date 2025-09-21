package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/lambda"

	cal "github.com/mbbennis/trc.yoga/backend/calendar"
	loc "github.com/mbbennis/trc.yoga/backend/location"
	"github.com/mbbennis/trc.yoga/backend/s3"
)

var (
	bucketName        = os.Getenv("BUCKET_NAME")
	locationsDataKey  = os.Getenv("LOCATIONS_DATA_KEY")
	calendarFolderKey = os.Getenv("CALENDAR_FOLDER_KEY")
)

func handleRequest(ctx context.Context, _ json.RawMessage) error {
	s3Client, err := s3.New(ctx, bucketName)
	if err != nil {
		log.Printf("Unable to create S3 client: %v", err)
		return err
	}
	httpClient := &http.Client{}

	locs, err := loc.LoadLocations(ctx, s3Client, locationsDataKey)
	if err != nil {
		log.Printf("Unable to load locations: %v", err)
		return err
	}

	eventsMap, err := cal.LoadCalendarEvents(locs, httpClient)
	if err != nil {
		log.Printf("Unable to load calendar events: %v", err)
		return err
	}

	if err := cal.WriteCalendars(ctx, s3Client, eventsMap, calendarFolderKey); err != nil {
		log.Printf("Unable to write calendars: %v", err)
		return err
	}

	log.Printf("Generated calendar files successfully!")

	return nil
}

func main() {
	lambda.Start(handleRequest)
}
