package s3

import (
	"bytes"
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type UploaderAPI interface {
	Upload(ctx context.Context, input *s3.PutObjectInput, opts ...func(*manager.Uploader)) (*manager.UploadOutput, error)
}

type DownloaderAPI interface {
	Download(ctx context.Context, w io.WriterAt, input *s3.GetObjectInput, opts ...func(*manager.Downloader)) (int64, error)
}

type Client struct {
	Uploader   UploaderAPI
	Downloader DownloaderAPI
	Bucket     string
}

func New(ctx context.Context, bucket string) (*Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	s3Client := s3.NewFromConfig(cfg)

	return &Client{
		Uploader:   manager.NewUploader(s3Client),
		Downloader: manager.NewDownloader(s3Client),
		Bucket:     bucket,
	}, nil
}

func (c *Client) Upload(ctx context.Context, data []byte, key string) error {
	_, err := c.Uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(data),
	})
	if err != nil {
		return fmt.Errorf("failed to upload key %q: %w", key, err)
	}
	return nil
}

func (c *Client) Download(ctx context.Context, key string) ([]byte, error) {
	buf := manager.NewWriteAtBuffer([]byte{})
	_, err := c.Downloader.Download(ctx, buf, &s3.GetObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download key %q: %w", key, err)
	}
	return buf.Bytes(), nil
}

func (c *Client) DownloadToWriter(ctx context.Context, w io.WriterAt, key string) error {
	_, err := c.Downloader.Download(ctx, w, &s3.GetObjectInput{
		Bucket: aws.String(c.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to download key %q: %w", key, err)
	}
	return nil
}
