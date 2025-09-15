# VRChat Jellyfin - Coolify Deployment Guide

This guide explains how to deploy the VRChat Jellyfin service using Coolify.

## Quick Start

1. **Use the Coolify-compliant docker-compose file**: `docker-compose.coolify.yml`
2. **Set required environment variables** in Coolify's interface
3. **Deploy** through Coolify

## Required Environment Variables

You **must** set these in Coolify's environment variables section:

| Variable | Description | Example |
|----------|-------------|---------|
| `JELLYFIN_HOST` | Your Jellyfin server URL | `https://jellyfin.example.com` |
| `JELLYFIN_USERNAME` | Jellyfin username | `vrchat` |
| `JELLYFIN_PASSWORD` | Jellyfin password | `your-secure-password` |

## Optional Environment Variables

These have sensible defaults but can be customized:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUDIO_BITRATE` | `192000` | Audio bitrate (bits per second) |
| `VIDEO_BITRATE` | `5000000` | Video bitrate (bits per second) |
| `MAX_AUDIO_CHANNELS` | `2` | Maximum audio channels |
| `MAX_HEIGHT` | `1080` | Maximum video height (pixels) |
| `MAX_WIDTH` | `1920` | Maximum video width (pixels) |

## Coolify-Specific Variables

These are typically managed automatically by Coolify:

- `COOLIFY_CONTAINER_NAME` - Container name
- `COOLIFY_PORT` - Port mapping
- `COOLIFY_DOMAIN` - Domain name
- `COOLIFY_HTTPS` - Enable HTTPS
- `COOLIFY_HEALTHCHECK_*` - Health check settings

## Deployment Steps

### 1. Create New Application in Coolify

1. Go to your Coolify dashboard
2. Click "New Application"
3. Choose "Docker Compose" as the source
4. Connect your Git repository or upload the `docker-compose.coolify.yml` file

### 2. Configure Environment Variables

1. In the application settings, go to "Environment Variables"
2. Add the required variables:
   - `JELLYFIN_HOST`
   - `JELLYFIN_USERNAME` 
   - `JELLYFIN_PASSWORD`
3. Optionally customize the quality settings

### 3. Configure Domain and HTTPS

1. Set your domain name in Coolify
2. Enable HTTPS if desired
3. Configure any redirects if needed

### 4. Deploy

1. Click "Deploy" in Coolify
2. Monitor the deployment logs
3. Access your service at the configured domain

## Usage

Once deployed:

1. Navigate to your configured domain
2. Browse your Jellyfin media library
3. Select a video to stream
4. Copy the generated link
5. Paste the link into VRChat to play the media

## Performance Tuning

### For High-Quality Streaming
```env
AUDIO_BITRATE=320000
VIDEO_BITRATE=8000000
MAX_HEIGHT=1440
MAX_WIDTH=2560
```

### For Low-Bandwidth Scenarios
```env
AUDIO_BITRATE=128000
VIDEO_BITRATE=2000000
MAX_HEIGHT=720
MAX_WIDTH=1280
```

### For Mobile/VR Optimization
```env
AUDIO_BITRATE=128000
VIDEO_BITRATE=3000000
MAX_HEIGHT=720
MAX_WIDTH=1280
MAX_AUDIO_CHANNELS=2
```

## Troubleshooting

### Common Issues

1. **Connection to Jellyfin fails**
   - Verify `JELLYFIN_HOST` is correct and accessible
   - Check username/password credentials
   - Ensure Jellyfin server allows API access

2. **Video won't play in VRChat**
   - Try different video quality settings
   - Use "Stream" mode instead of "Video" in VRChat
   - Check if the video format is supported

3. **Poor performance**
   - Reduce `VIDEO_BITRATE` and `AUDIO_BITRATE`
   - Lower `MAX_HEIGHT` and `MAX_WIDTH`
   - Check server resources

### Health Check

The service includes a health check endpoint at `/` that Coolify uses to monitor the service status.

## Security Notes

- Never commit `.env` files with real credentials
- Use strong passwords for Jellyfin access
- Consider using Jellyfin API keys instead of passwords
- Enable HTTPS in production

## Support

For issues specific to this deployment:
- Check the application logs in Coolify
- Verify all environment variables are set correctly
- Test Jellyfin connectivity independently

For general VRChat Jellyfin issues:
- Check the main project repository
- Review the main README.md for troubleshooting
