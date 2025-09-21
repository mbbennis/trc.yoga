package utils

import (
	"bufio"
	"bytes"
	"io"
	"strings"
)

func CleanLineEndings(reader io.Reader) io.Reader {
	var buf bytes.Buffer

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		cleanedLine := strings.TrimRight(scanner.Text(), "\r")
		buf.WriteString(cleanedLine + "\n")
	}

	return &buf
}

func GenerateCombinations(values []string) [][]string {
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
