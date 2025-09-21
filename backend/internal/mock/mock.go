package mock

import (
	"bytes"
	"context"
	"io"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type MockUploader struct {
	Called bool
	Count  int
	Input  *s3.PutObjectInput
	Err    error
}

func (m *MockUploader) Upload(ctx context.Context, input *s3.PutObjectInput, _ ...func(*manager.Uploader)) (*manager.UploadOutput, error) {
	m.Called = true
	m.Count++
	m.Input = input
	if m.Err != nil {
		return nil, m.Err
	}
	return &manager.UploadOutput{}, nil
}

type MockDownloader struct {
	Called bool
	Input  *s3.GetObjectInput
	Data   []byte
	Err    error
}

func (m *MockDownloader) Download(ctx context.Context, w io.WriterAt, input *s3.GetObjectInput, _ ...func(*manager.Downloader)) (int64, error) {
	m.Called = true
	m.Input = input
	if m.Err != nil {
		return 0, m.Err
	}
	n, _ := w.WriteAt(m.Data, 0)
	return int64(n), nil
}

type MockHTTPClient struct {
	Data []byte
	Err  error
}

func (m *MockHTTPClient) Get(url string) (*http.Response, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewReader(m.Data)),
	}, nil
}
