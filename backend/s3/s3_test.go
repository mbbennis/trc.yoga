package s3

import (
	"context"
	"errors"
	"testing"

	"github.com/mbbennis/trc.yoga/backend/internal/mock"
)

func TestClient_Upload_Success(t *testing.T) {
	mockUp := &mock.MockUploader{}
	client := &Client{Uploader: mockUp, Bucket: "test-bucket"}

	err := client.Upload(context.Background(), []byte("hello"), "key.txt")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !mockUp.Called {
		t.Error("expected Upload to be called")
	}
	if *mockUp.Input.Bucket != "test-bucket" {
		t.Errorf("expected bucket test-bucket, got %s", *mockUp.Input.Bucket)
	}
	if *mockUp.Input.Key != "key.txt" {
		t.Errorf("expected key key.txt, got %s", *mockUp.Input.Key)
	}
}

func TestClient_Upload_Error(t *testing.T) {
	mockUp := &mock.MockUploader{Err: errors.New("upload failed")}
	client := &Client{Uploader: mockUp, Bucket: "test-bucket"}

	err := client.Upload(context.Background(), []byte("hello"), "key.txt")
	if err == nil || err.Error() != `failed to upload key "key.txt": upload failed` {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestClient_Download_Success(t *testing.T) {
	mockDown := &mock.MockDownloader{Data: []byte("world")}
	client := &Client{Downloader: mockDown, Bucket: "test-bucket"}

	data, err := client.Download(context.Background(), "key.txt")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if string(data) != "world" {
		t.Errorf("expected world, got %s", string(data))
	}
	if !mockDown.Called {
		t.Error("expected Download to be called")
	}
}

func TestClient_Download_Error(t *testing.T) {
	mockDown := &mock.MockDownloader{Err: errors.New("download failed")}
	client := &Client{Downloader: mockDown, Bucket: "test-bucket"}

	_, err := client.Download(context.Background(), "key.txt")
	if err == nil || err.Error() != `failed to download key "key.txt": download failed` {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

func TestClient_DownloadToWriter_Success(t *testing.T) {
	mockDown := &mock.MockDownloader{Data: []byte("abc")}
	client := &Client{Downloader: mockDown, Bucket: "test-bucket"}

	buf := make([]byte, 10)
	writer := &memWriter{buf}

	err := client.DownloadToWriter(context.Background(), writer, "key.txt")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if string(buf[:3]) != "abc" {
		t.Errorf("expected abc, got %s", string(buf[:3]))
	}
}

func TestClient_DownloadToWriter_Error(t *testing.T) {
	mockDown := &mock.MockDownloader{Err: errors.New("download failed")}
	client := &Client{Downloader: mockDown, Bucket: "test-bucket"}

	writer := &memWriter{make([]byte, 10)}
	err := client.DownloadToWriter(context.Background(), writer, "key.txt")
	if err == nil || err.Error() != `failed to download key "key.txt": download failed` {
		t.Fatalf("expected wrapped error, got %v", err)
	}
}

// memWriter is a tiny helper that satisfies io.WriterAt
type memWriter struct{ buf []byte }

func (m *memWriter) WriteAt(p []byte, off int64) (int, error) {
	copy(m.buf[off:], p)
	return len(p), nil
}
