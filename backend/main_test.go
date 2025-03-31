package main

import (
	"bytes"
	"io"
	"testing"

	ics "github.com/arran4/golang-ical"
	"github.com/stretchr/testify/assert"
)

func TestIsYogaEventWithSummary(t *testing.T) {
	event := ics.NewEvent("1")
	event.SetSummary("Yoga Class")
	assert.True(t, isYogaEvent(event))

	event.SetSummary("Pilates Session")
	assert.False(t, isYogaEvent(event))
}

func TestIsYogaEventWithDescription(t *testing.T) {
	event := ics.NewEvent("1")
	event.SetDescription("Yoga Class")
	assert.True(t, isYogaEvent(event))

	event.SetDescription("Pilates Session")
	assert.False(t, isYogaEvent(event))
}

func TestCleanLineEndings(t *testing.T) {
	input := "Line1\r\nLine2\r\n"
	reader := cleanLineEndings(bytes.NewReader([]byte(input)))
	output, _ := io.ReadAll(reader)
	assert.Equal(t, "Line1\nLine2\n", string(output))
}

func TestGenerateCombinationsEmpty(t *testing.T) {
	result := generateCombinations([]string{})
	assert.Equal(t, [][]string{}, result)
}

func TestGenerateCombinationsOneElement(t *testing.T) {
	result := generateCombinations([]string{"a"})
	assert.Equal(t, [][]string{{"a"}}, result)
}

func TestGenerateCombinationsMultipleElements(t *testing.T) {
	result := generateCombinations([]string{"a", "b", "c"})
	assert.Equal(t, [][]string{{"a"}, {"b"}, {"a", "b"}, {"c"}, {"a", "c"}, {"b", "c"}, {"a", "b", "c"}}, result)
}
