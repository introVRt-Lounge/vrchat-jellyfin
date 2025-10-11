# VRChat Jellyfin UI Modernization Build Plan

## Overview ✅ COMPLETE
Transform the vanilla TypeScript frontend into a modern React + HeroUI interface while maintaining all existing functionality. The goal is to create a thumbnail-heavy, searchable media browser that offers the same core functionality (proxy URL generation) but with a vastly improved user experience.

**Status: ✅ FULLY IMPLEMENTED**
- All phases completed successfully
- Same backend API compatibility maintained
- Ready for PR submission to original creator

## API Investigation Results ✅
- **Library Types**: Views have `CollectionType` field ("Movies" or "TvShows")
- **Thumbnails**: Items have `ImageTags` object, construct URLs as `/Items/{itemId}/Images/Primary?tag={tag}&api_key={key}`
- **Subtitles**: Items have `MediaStreams` array, filter by `Type === "Subtitle"`, each has `Language` field (ISO codes like "en", "es")
- **Search**: Need server-side search API implementation

## Architecture Decisions
- **Frontend**: React + HeroUI (Vite-based) replacing vanilla TypeScript
- **Routing**: Client-side routing (React Router) for performance
- **Search**: Server-side filtering for large libraries
- **Data Loading**: Progressive loading for TV shows (shows → seasons → episodes)
- **Styling**: HeroUI components with custom dark theme

## Phase 1: Setup & Infrastructure

### 1.1 React + HeroUI Setup
**Tasks:**
- Install React, React DOM, HeroUI dependencies
- Configure Vite for React + TypeScript
- Set up HeroUI provider with dark theme
- Configure Tailwind CSS v4 (HeroUI requirement)
- Update build scripts

**Files to create/modify:**
- `package.json` - Add React dependencies
- `vite.config.ts` - React plugin
- `client/index.html` - HeroUI provider setup
- `tailwind.config.js` - HeroUI theme config

### 1.2 Backend API Extensions
**New Endpoints Needed:**
- `GET /libraries` - Return library cards data (name, type, thumbnail)
- `GET /libraries/:id/items?search=...&limit=...&offset=...` - Paginated items with thumbnails
- `GET /tvshows/:id/seasons` - Seasons for a TV show
- `GET /seasons/:id/episodes` - Episodes for a season
- `GET /items/:id/details` - Full item details with MediaStreams

**Files to modify:**
- `src/jellyfin/client.ts` - Add new methods
- `src/webserver/index.ts` - Add new routes

## Phase 2: Core Components

### 2.1 Library Homepage
**Features:**
- Grid of library cards
- Each card shows library name, type icon, and thumbnail
- Click navigates to library view

**Components:**
- `LibraryCard` - Individual library card
- `LibraryGrid` - Grid layout
- `HomePage` - Main homepage

### 2.2 Search & Filter System
**Features:**
- Real-time search input with debouncing
- Visual search state indicators
- "Clear search" functionality
- Search results count

**Components:**
- `SearchBar` - Search input with icons
- `SearchStatus` - "Searching...", "X results", etc.

### 2.3 Movie Library View
**Features:**
- Thumbnail grid of movies
- Each movie card shows poster + available subtitles
- Subtitle indicators show language flags/codes
- Click movie → subtitle selection modal

**Components:**
- `MovieCard` - Movie thumbnail with subtitle badges
- `MovieGrid` - Responsive grid layout
- `SubtitleBadge` - Language flag + code display

### 2.4 TV Show Hierarchy
**Flow:** TV Shows Page → Seasons Page → Episodes Page

**Features:**
- **TV Shows Page**: Grid of show posters
- **Seasons Page**: Show header + season cards
- **Episodes Page**: Season header + episode grid with subtitles

**Components:**
- `TVShowCard` - Show poster card
- `SeasonCard` - Season navigation card
- `EpisodeCard` - Episode with subtitle badges
- `ShowHeader` - Show/season title + metadata

## Phase 3: Subtitle Selection & URL Generation

### 3.1 Subtitle Selection Modal
**Features:**
- List available subtitle tracks
- Show language names + flags
- "No subtitles" option
- Auto-close on selection

**Components:**
- `SubtitleModal` - Modal with subtitle options
- `SubtitleOption` - Individual subtitle choice

### 3.2 URL Display & Copy
**Features:**
- Text input showing generated proxy URL
- Auto-copy to clipboard
- Visual feedback ("Copied!")
- Clear URL after timeout

**Components:**
- `UrlDisplay` - Input field with copy button
- `CopyFeedback` - Toast/alert for copy confirmation

## Phase 4: Routing & Navigation

### 4.1 Client-Side Routing
**Routes:**
- `/` - Library homepage
- `/library/:id` - Library items view
- `/tvshow/:id` - TV show seasons
- `/season/:id` - Season episodes

**Setup:**
- React Router configuration
- Navigation guards
- Loading states between routes

## Phase 5: Polish & Testing ✅

### 5.1 UI Polish ✅
- ✅ Loading states and skeletons
- ✅ Error handling and user feedback
- ✅ Responsive design for mobile
- ✅ Keyboard navigation support

### 5.2 Testing & Validation ✅
- ✅ All existing proxy functionality works
- ✅ URL generation identical to original
- ✅ Search works across all views
- ✅ Progressive loading doesn't break TV flow
- ✅ Build compiles successfully
- ✅ Same backend API compatibility maintained

## Technical Implementation Details

### Thumbnail URL Construction
```typescript
const getThumbnailUrl = (itemId: string, imageTag: string) => {
  return `${serverUrl}/Items/${itemId}/Images/Primary?tag=${imageTag}&api_key=${apiKey}&maxWidth=300&maxHeight=450`;
};
```

### Subtitle Language Display
- Use ISO language codes from `MediaStream.Language`
- Map to country flags using flag emoji or flag icons
- Fallback to language code if no flag available

### Search Implementation
- Server-side: `getItemsApi().getItems({ parentId, searchTerm, limit, offset })`
- Debounced search input (300ms)
- Clear search button when active

### Progressive TV Loading
```typescript
// Load shows: GET /libraries/:tvLibraryId/items?limit=50
// Load seasons: GET /tvshows/:showId/seasons
// Load episodes: GET /seasons/:seasonId/episodes
```

## Dependencies to Add
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.8.0",
  "@heroui/react": "^2.8.0",
  "framer-motion": "^11.9.0",
  "tailwindcss": "^4.0.0",
  "@types/react": "^18.0.0",
  "@types/react-dom": "^18.0.0"
}
```

## Migration Strategy
1. Create new React frontend alongside existing vanilla TS
2. Implement features incrementally, testing against existing backend
3. Once complete, replace old client files
4. Ensure all original functionality preserved

## Success Criteria
- ✅ All proxy URL generation works identically
- ✅ Search functionality works across all media types
- ✅ Progressive loading prevents slow TV show browsing
- ✅ Thumbnail-heavy interface loads fast
- ✅ Responsive design works on mobile/desktop
- ✅ Same backend API compatibility (can submit as PR)
