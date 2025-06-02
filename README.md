# YouTube Phrase Search Webapp

A powerful webapp that allows you to search for specific phrases within YouTube videos and jump directly to the exact timestamp where they're spoken.

## Overview

This application has been converted from a SaaS admin template into a comprehensive YouTube phrase search system:

- **Admin Panel**: Manage search terms and monitor video discovery
- **Automated Discovery**: Finds relevant YouTube videos for admin-defined search terms
- **Subtitle Processing**: Downloads and indexes video subtitles with timestamps
- **Real-time Search**: End-users can search for phrases and get instant results
- **Direct YouTube Links**: Click results to jump to exact moments in videos

## Key Features

### For Administrators
- ✅ Add/remove search terms (e.g., "AstroJS tutorials", "sustainable gardening")
- ✅ Monitor video discovery progress and processing status  
- ✅ View discovered videos and indexed phrases
- ✅ Trigger manual video discovery runs

### For End Users
- ✅ Real-time phrase search with debounced input
- ✅ Results show video thumbnails, titles, and matching phrases
- ✅ Click to open YouTube videos at exact timestamps
- ✅ Fast full-text search using SQLite FTS5

## Architecture

### Frontend
- **Astro** - Static site generation with dynamic components
- **React** - Interactive search and admin components
- **Tailwind CSS** - Modern styling system

### Backend
- **Astro API Routes** - RESTful endpoints for search and admin functions
- **Cloudflare D1** - SQLite database for storing videos and phrases
- **Cloudflare Workers** - Background processing workflows

### Workflows
1. **VideoDiscoveryWorkflow** - Discovers YouTube videos using search terms
2. **SubtitleProcessingWorkflow** - Downloads and indexes video subtitles

## Database Schema

### Core Tables
- `admins` - Admin user accounts
- `search_terms` - Search terms for video discovery  
- `videos` - Discovered YouTube videos with metadata
- `video_phrases` - Indexed phrases with timestamps
- `video_phrases_fts` - Full-text search index for phrases

## Setup Instructions

### 1. Environment Configuration

Update `wrangler.jsonc` with your configuration:

```json
{
  "vars": {
    "YOUTUBE_API_KEY": "your_actual_youtube_api_key",
    "ADMIN_PASSWORD_HASH": "your_bcrypt_hashed_password"
  }
}
```

### 2. YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the YouTube Data API v3
4. Create an API key and add it to your environment variables

### 3. Database Migration

```bash
# Local development
npm run db:migrate

# Production deployment  
npm run db:migrate:remote
```

### 4. Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Usage

### Admin Access
1. Navigate to `/admin` 
2. Login with admin credentials (default: admin@example.com / admin123)
3. Add search terms like "AstroJS tutorials" or "React hooks explained"
4. Click "Run" to trigger video discovery for each term
5. Monitor processing status and view discovered videos

### End User Search
1. Visit the homepage
2. Type phrases like "how to deploy" or "useState hook"
3. Click results to jump to exact timestamps in YouTube videos
4. Results update in real-time as you type

## Project Structure

```
src/
├── components/
│   ├── admin/                    # Admin interface components
│   ├── ui/                       # Reusable UI components  
│   └── phrase-search.tsx         # Main search interface
├── pages/
│   ├── api/                      # API endpoints
│   ├── admin/                    # Admin pages
│   └── index.astro               # Homepage with search
├── workflows/                    # Background processing
│   ├── video_discovery_workflow.ts
│   └── subtitle_processing_workflow.ts
└── layouts/                      # Page layouts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.