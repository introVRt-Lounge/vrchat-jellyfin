# Docker Deployment

This project includes a `docker-compose.yml` file for easy deployment with Docker Compose platforms like Coolify, Railway, Render, or any Docker Compose-compatible service.

## Required Environment Variables

Set these in your deployment platform:

- `JELLYFIN_HOST` - Your Jellyfin server URL
- `JELLYFIN_USERNAME` - Jellyfin username  
- `JELLYFIN_PASSWORD` - Jellyfin password

## Optional Variables

All have sensible defaults:

- `AUDIO_BITRATE` (default: 192000)
- `VIDEO_BITRATE` (default: 5000000) 
- `MAX_AUDIO_CHANNELS` (default: 2)
- `MAX_HEIGHT` (default: 1080)
- `MAX_WIDTH` (default: 1920)

See `.env.example` for all available options.

## Deployment

1. Connect your Git repository to your platform
2. Set the required environment variables
3. Deploy

The service will be available on port 4000 with health checks enabled.
