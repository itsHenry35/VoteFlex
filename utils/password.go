package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	mrand "math/rand"
	"time"
)

const (
	letters      = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	shortCodeLen = 8
)

// GenerateRandomPassword 生成随机密码
func GenerateRandomPassword(length int) (string, error) {
	r := mrand.New(mrand.NewSource(time.Now().UnixNano()))
	b := make([]byte, length)
	for i := range b {
		b[i] = letters[r.Intn(len(letters))]
	}
	return string(b), nil
}

// GenerateSecureToken 生成安全的随机令牌
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// GenerateUUID 生成UUID格式的唯一标识
func GenerateUUID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based approach if crypto/rand fails
		r := mrand.New(mrand.NewSource(time.Now().UnixNano()))
		for i := range bytes {
			bytes[i] = byte(r.Intn(256))
		}
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		bytes[0:4], bytes[4:6], bytes[6:8], bytes[8:10], bytes[10:16])
}

// GenerateShortCode 生成短链接代码
func GenerateShortCode() string {
	r := mrand.New(mrand.NewSource(time.Now().UnixNano()))
	b := make([]byte, shortCodeLen)
	for i := range b {
		b[i] = letters[r.Intn(len(letters))]
	}
	return string(b)
}
