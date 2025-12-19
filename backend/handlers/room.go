package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/livekit/protocol/auth"
	"video-call-backend/config"
)

type RoomHandler struct {
	config *config.Config
}

func NewRoomHandler(cfg *config.Config) *RoomHandler {
	return &RoomHandler{config: cfg}
}

type TokenRequest struct {
	RoomName        string `json:"roomName"`
	ParticipantName string `json:"participantName"`
}

type TokenResponse struct {
	Token string `json:"token"`
}

// GenerateToken creates a LiveKit access token for a participant
func (h *RoomHandler) GenerateToken(c *fiber.Ctx) error {
	var req TokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.RoomName == "" || req.ParticipantName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "roomName and participantName are required",
		})
	}

	// Create access token
	at := auth.NewAccessToken(h.config.LiveKitAPIKey, h.config.LiveKitAPISecret)

	// Create video grant
	grant := &auth.VideoGrant{
		RoomJoin: true,
		Room:     req.RoomName,
	}

	at.AddGrant(grant).
		SetIdentity(req.ParticipantName).
		SetValidFor(time.Hour * 24)

	token, err := at.ToJWT()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
		})
	}

	return c.JSON(TokenResponse{Token: token})
}

// GetRooms returns a list of active rooms (placeholder for future implementation)
func (h *RoomHandler) GetRooms(c *fiber.Ctx) error {
	// For a simple test site, we don't need room listing
	// This can be expanded later using LiveKit's RoomService
	return c.JSON(fiber.Map{
		"rooms": []string{},
	})
}
