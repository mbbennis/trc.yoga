package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"maps"
	"net/http"
	"os"
	"slices"
	"strings"

	ics "github.com/arran4/golang-ical"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
)

var (
	region            = os.Getenv("AWS_REGION")
	bucketName        = os.Getenv("BUCKET_NAME")
	locationsDataKey  = os.Getenv("LOCATIONS_DATA_KEY")
	calendarFolderKey = os.Getenv("CALENDAR_FOLDER_KEY")

	s3Client S3Client
)

func handleRequest(_ context.Context, _ json.RawMessage) error {
	sess := session.Must(session.NewSession(
		&aws.Config{Region: aws.String(region)},
	))
	s3Client = newS3Client(sess, bucketName)

	locs, err := loadLocations(locationsDataKey)
	if err != nil {
		return err
	}

	eventsMap, err := loadCalendarEvents(locs)
	if err != nil {
		return err
	}

	if err := writeCalendars(eventsMap, calendarFolderKey); err != nil {
		return err
	}

	log.Printf("Generated calendar files successfully!")

	return nil
}

func main() {
	lambda.Start(handleRequest)
}

type S3Client struct {
	Uploader   *s3manager.Uploader
	Downloader *s3manager.Downloader
	Bucket     string
}

func newS3Client(session *session.Session, bucket string) S3Client {
	return S3Client{
		Uploader:   s3manager.NewUploader(session),
		Downloader: s3manager.NewDownloader(session),
		Bucket:     bucket,
	}
}

func (s S3Client) Upload(data []byte, key string) error {
	_, err := s.Uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(data),
	})

	return err
}

func (s S3Client) Download(key string) ([]byte, error) {
	buf := &aws.WriteAtBuffer{}

	_, err := s.Downloader.Download(buf, &s3.GetObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func loadLocations(key string) ([]Location, error) {
	bytes, err := s3Client.Download(key)
	if err != nil {
		return nil, err
	}

	locs := []Location{}
	if err := json.Unmarshal(bytes, &locs); err != nil {
		return nil, err
	}

	return locs, nil
}

type Location struct {
	Name        string `json:"name"`
	ShortName   string `json:"shortName"`
	Address     string `json:"address"`
	CalendarURL string `json:"calendarUrl"`
}

func (l Location) GetYogaEvents() ([]*ics.VEvent, error) {
	cal, err := l.fetchCalendar()
	if err != nil {
		return nil, err
	}

	events := filterForYogaEvents(cal.Events())
	l.enrichEvents(events)

	return events, nil
}

func (l Location) fetchCalendar() (*ics.Calendar, error) {
	resp, err := http.Get(l.CalendarURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	cleanedBody := cleanLineEndings(resp.Body)

	return ics.ParseCalendar(cleanedBody)
}

func (l Location) enrichEvents(events []*ics.VEvent) {
	for _, e := range events {
		e.AddCategory(l.Name)
		e.SetLocation(l.Address)
	}
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

func cleanLineEndings(reader io.Reader) io.Reader {
	var buf bytes.Buffer

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		cleanedLine := strings.TrimRight(scanner.Text(), "\r")
		buf.WriteString(cleanedLine + "\n")
	}

	return &buf
}

func loadCalendarEvents(locs []Location) (map[string][]*ics.VEvent, error) {
	eventsMap := make(map[string][]*ics.VEvent, len(locs))

	for _, loc := range locs {
		log.Printf("Getting events for %v", loc.Name)

		events, err := loc.GetYogaEvents()
		if err != nil {
			return nil, err
		}

		eventsMap[loc.ShortName] = events
	}

	return eventsMap, nil
}

func writeCalendars(events map[string][]*ics.VEvent, dir string) error {
	keys := slices.Sorted(maps.Keys(events))
	combinations := generateCombinations(keys)

	for _, comb := range combinations {
		var buf bytes.Buffer

		err := buildCalendar(events, comb).SerializeTo(&buf)
		if err != nil {
			return err
		}

		key := fmt.Sprintf("%s/%s.ical", dir, strings.Join(comb, "_"))
		log.Printf("Writing calendar file: %v", key)

		if err = s3Client.Upload(buf.Bytes(), key); err != nil {
			return err
		}
	}

	return nil
}

func generateCombinations(values []string) [][]string {
	combinations := [][]string{}

	for _, current := range values {
		n := len(combinations)
		combinations = append(combinations, []string{current})

		for i := range n {
			subset := make([]string, len(combinations[i]))
			copy(subset, combinations[i])
			subset = append(subset, current)
			combinations = append(combinations, subset)
		}
	}

	return combinations
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
