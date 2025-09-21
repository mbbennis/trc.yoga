package utils

import (
	"io"
	"strings"
	"testing"
)

func TestCleanLineEndings_CRLF(t *testing.T) {
	input := "line1\r\nline2\r\nline3\r\n"
	expected := "line1\nline2\nline3\n"

	reader := CleanLineEndings(strings.NewReader(input))
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(output) != expected {
		t.Errorf("expected %q, got %q", expected, string(output))
	}
}

func TestCleanLineEndings_LF(t *testing.T) {
	input := "line1\nline2\n"
	expected := "line1\nline2\n"

	reader := CleanLineEndings(strings.NewReader(input))
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(output) != expected {
		t.Errorf("expected %q, got %q", expected, string(output))
	}
}

func TestCleanLineEndings_Mixed(t *testing.T) {
	input := "line1\r\nline2\nline3\r\n"
	expected := "line1\nline2\nline3\n"

	reader := CleanLineEndings(strings.NewReader(input))
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(output) != expected {
		t.Errorf("expected %q, got %q", expected, string(output))
	}
}

func TestCleanLineEndings_NoTrailingNewline(t *testing.T) {
	input := "line1\r\nline2"
	expected := "line1\nline2\n"

	reader := CleanLineEndings(strings.NewReader(input))
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(output) != expected {
		t.Errorf("expected %q, got %q", expected, string(output))
	}
}

func TestCleanLineEndings_Empty(t *testing.T) {
	input := ""
	expected := ""

	reader := CleanLineEndings(strings.NewReader(input))
	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if string(output) != expected {
		t.Errorf("expected %q, got %q", expected, string(output))
	}
}

func TestGenerateCombinations_Empty(t *testing.T) {
	input := []string{}
	expected := [][]string{}

	got := GenerateCombinations(input)
	if len(got) != len(expected) {
		t.Errorf("expected %v, got %v", expected, got)
	}
}

func TestGenerateCombinations_Single(t *testing.T) {
	input := []string{"a"}
	expected := [][]string{
		{"a"},
	}

	got := GenerateCombinations(input)
	if len(got) != len(expected) || got[0][0] != "a" {
		t.Errorf("expected %v, got %v", expected, got)
	}
}

func TestGenerateCombinations_Two(t *testing.T) {
	input := []string{"a", "b"}
	expected := [][]string{
		{"a"},
		{"b"},
		{"a", "b"},
	}

	got := GenerateCombinations(input)
	if len(got) != len(expected) {
		t.Fatalf("expected %d combinations, got %d", len(expected), len(got))
	}

	for i := range expected {
		for j := range expected[i] {
			if got[i][j] != expected[i][j] {
				t.Errorf("expected %v, got %v", expected, got)
			}
		}
	}
}

func TestGenerateCombinations_Three(t *testing.T) {
	input := []string{"a", "b", "c"}
	expected := [][]string{
		{"a"},
		{"b"},
		{"a", "b"},
		{"c"},
		{"a", "c"},
		{"b", "c"},
		{"a", "b", "c"},
	}

	got := GenerateCombinations(input)
	if len(got) != len(expected) {
		t.Fatalf("expected %d combinations, got %d", len(expected), len(got))
	}

	for i := range expected {
		for j := range expected[i] {
			if got[i][j] != expected[i][j] {
				t.Errorf("expected %v, got %v", expected, got)
			}
		}
	}
}
