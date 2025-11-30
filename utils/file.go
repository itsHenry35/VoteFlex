package utils

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	maxUploadSize = 10 << 20 // 10 MB
	uploadDir     = "./data/uploads"
)

// SaveUploadedFile 保存上传的文件并返回访问URL
func SaveUploadedFile(header *multipart.FileHeader) (string, error) {
	// 检查文件大小
	if header.Size > maxUploadSize {
		return "", fmt.Errorf("文件大小超过限制（最大 10MB）")
	}

	// 验证文件类型
	contentType := header.Header.Get("Content-Type")
	if !isAllowedFileType(contentType) {
		return "", fmt.Errorf("不支持的文件类型: %s", contentType)
	}

	// 确保上传目录存在
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", fmt.Errorf("创建上传目录失败: %w", err)
	}

	// 生成唯一文件名
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), GenerateShortCode(), ext)
	filePath := filepath.Join(uploadDir, filename)

	// 打开上传的文件
	file, err := header.Open()
	if err != nil {
		return "", fmt.Errorf("打开上传文件失败: %w", err)
	}
	defer file.Close()

	// 创建目标文件
	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("保存文件失败: %w", err)
	}

	// 返回文件URL
	fileURL := fmt.Sprintf("/uploads/%s", filename)
	return fileURL, nil
}

// DeleteUploadedFile 删除已上传的文件
func DeleteUploadedFile(fileURL string) error {
	// 从URL中提取文件名
	// fileURL格式: /uploads/filename.ext
	if !strings.HasPrefix(fileURL, "/uploads/") {
		return nil // 不是我们上传的文件，忽略
	}

	filename := strings.TrimPrefix(fileURL, "/uploads/")
	filePath := filepath.Join(uploadDir, filename)

	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil // 文件不存在，忽略
	}

	// 删除文件
	return os.Remove(filePath)
}

// isAllowedFileType 检查文件类型是否允许
func isAllowedFileType(contentType string) bool {
	allowedTypes := []string{
		// 图片
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/svg+xml",
		"image/bmp",
		"image/tiff",
		"image/x-icon",
		// 音频
		"audio/mpeg",      // MP3
		"audio/mp3",
		"audio/wav",
		"audio/wave",
		"audio/x-wav",
		"audio/ogg",
		"audio/webm",
		"audio/flac",      // FLAC
		"audio/x-flac",
		"audio/aac",       // AAC
		"audio/mp4",       // M4A
		"audio/x-m4a",
		"audio/opus",      // Opus
		"audio/x-ms-wma",  // WMA
		// 视频
		"video/mp4",
		"video/webm",
		"video/ogg",
		"video/quicktime", // MOV
		"video/x-msvideo", // AVI
		"video/x-ms-wmv",  // WMV
		"video/x-flv",     // FLV
		"video/x-matroska", // MKV
		"video/mpeg",
	}

	for _, allowed := range allowedTypes {
		if strings.HasPrefix(contentType, allowed) {
			return true
		}
	}
	return false
}
