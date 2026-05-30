# Search & Filters Implementation

## Overview

Comprehensive global search functionality with advanced filtering and analytics tracking for the ExamAce Nepal platform. Users can search across all resource types (past papers, notes, videos, assignments) with multi-field filtering and sorting options.

## Features

### 1. Global Search
- **Text Search**: Full-text search across titles, descriptions, content, and tags
- **Keyword Examples**:
  - "BIT DBMS 2080" - searches for DBMS past papers from 2080
  - "SEE science notes" - searches for science study notes
  - "MCA networking TU" - searches for networking resources

### 2. Multi-Field Filtering
- **By Resource Type**: Papers, Notes, Videos, Assignments
- **By Subject**: Filter by category (subject, university, faculty)
- **By Year**: Filter past papers by year
- **By Semester**: Filter by semester number
- **PDF Only**: Show only downloadable PDF files

### 3. Sorting Options
- **Latest**: Most recently uploaded resources
- **Most Viewed**: Resources with highest view count
- **Most Downloaded**: Resources with most downloads

### 4. Analytics Tracking
- **View Tracking**: Track when resources are viewed
- **Download Tracking**: Track when resources are downloaded
- **Trending Resources**: API endpoint to get trending resources

## Backend Implementation

### Database Schema Updates

#### Enhanced Resource Models
Each resource type now includes:
- `view_count: int` - Number of times viewed
- `download_count: int` - Number of times downloaded
- `created_at: str` - Timestamp when created

**Updated Models:**
- `PastQuestionPaper`
- `StudyNote`
- `VideoSolution`
- `Assignment`

### New API Endpoints

#### 1. Global Search
```
GET /api/search
Query Parameters:
  - q (string): Keyword search
  - subject (string): Filter by subject
  - university (string): Filter by university
  - year (integer): Filter by year
  - semester (integer): Filter by semester
  - faculty (string): Filter by faculty
  - resource_type (string): Filter by type (papers, notes, videos, assignments)
  - sort_by (string): Sort order (latest, most_viewed, most_downloaded)
  - limit (integer): Max results (default: 50)

Response: Array of SearchResult objects
```

**Example Requests:**
```bash
# Search for DBMS notes
GET /api/search?q=DBMS&resource_type=notes&sort_by=latest

# Search for papers from 2080
GET /api/search?q=papers&year=2080&sort_by=most_viewed

# Search for TU resources
GET /api/search?q=TU&university=tribhuvan&limit=20
```

#### 2. View Tracking
```
POST /api/resources/{resource_type}/{resource_id}/view
Parameters:
  - resource_type: "paper" | "note" | "video" | "assignment"
  - resource_id: Unique resource identifier

Response:
{
  "success": true,
  "resource_type": "paper",
  "resource_id": "pp_001"
}
```

#### 3. Download Tracking
```
POST /api/resources/{resource_type}/{resource_id}/download
Parameters:
  - resource_type: "paper" | "note" | "video" | "assignment"
  - resource_id: Unique resource identifier

Response:
{
  "success": true,
  "resource_type": "paper",
  "resource_id": "pp_001"
}
```

#### 4. Trending Resources
```
GET /api/analytics/trending
Query Parameters:
  - days (integer): Last N days (default: 7)
  - limit (integer): Max resources (default: 10)

Response: Array of trending resources sorted by views + downloads
```

### Search Query Implementation

```python
@api.get("/search")
async def search_resources(
    q: Optional[str] = None,
    subject: Optional[str] = None,
    university: Optional[str] = None,
    year: Optional[int] = None,
    semester: Optional[int] = None,
    faculty: Optional[str] = None,
    resource_type: Optional[str] = None,
    sort_by: str = "latest",
    limit: int = 50
):
```

**Search Strategy:**
1. Build MongoDB aggregation pipeline with $or conditions for keyword matching
2. Apply field-specific filters (year, semester, subject via regex)
3. Search across all resource collections in parallel
4. Combine results from all resource types
5. Merge and sort by current sort_by parameter
6. Return top N results

**MongoDB Query Example:**
```
{
  $or: [
    { title: { $regex: "DBMS", $options: "i" } },
    { description: { $regex: "DBMS", $options: "i" } },
    { content: { $regex: "DBMS", $options: "i" } },
    { tags: { $elemMatch: { $regex: "DBMS", $options: "i" } } }
  ],
  year: 2080,
  semester: { $exists: true }
}
```

## Frontend Implementation

### Search Screen Component

**File:** `frontend/app/search.tsx`

**Features:**
- Real-time search with debouncing
- Advanced filter panel
- Multi-resource type display
- View/download tracking
- Trending resources display
- Offline cache support

### Search UI Components

#### 1. Search Bar
- Placeholder: "Search by subject, year, keyword..."
- Auto-clear button when text present
- Debounced search (500ms)

#### 2. Quick Filters
- Resource type buttons (Papers, Notes, Videos, Assignments)
- Advanced filters toggle
- Horizontal scrollable filter row

#### 3. Advanced Filters
- **Sort Options:**
  - Latest (created_at DESC)
  - Most Viewed (view_count DESC)
  - Most Downloaded (download_count DESC)
- **Additional Filters:**
  - PDF Only checkbox

#### 4. Search Results Display
- Resource cards showing:
  - Resource type icon with color coding
  - Title and description
  - Tags (up to 3)
  - View/download counts
  - Creation date
  - Year (for papers)

#### 5. Result Card Actions
- Tap to open resource detail
- Track view automatically
- Display stats overlay

### Colors & Icons

**Resource Type Colors:**
- Papers: `#38BDF8` (Light Blue)
- Notes: `#4ADE80` (Light Green)
- Videos: `#F59E0B` (Amber)
- Assignments: `#EF4444` (Red)

**Icons:**
- Paper: `file-pdf-box`
- Note: `note-text`
- Video: `play-circle`
- Assignment: `checkbox-marked-circle`

### Caching Strategy

**Search Results Cache:**
- TTL: 1 hour (3600000ms)
- Key: `search-${query}-${filters}`
- Fallback: Show cache if offline
- Refresh: Manual refresh button

### Integration Points

#### 1. Dashboard Integration
- Global search bar in welcome section
- Quick access to search functionality
- Press to open search screen

#### 2. Navigation
- Search screen route: `/search`
- Pass initial query via params
- Example: `/search?initial_query=DBMS`

### TypeScript Interface

```typescript
interface SearchResult {
  resource_type: 'paper' | 'note' | 'video' | 'assignment';
  resource_id: string;
  title: string;
  description?: string;
  node_id: string;
  year?: number;
  semester?: number;
  exam_type?: string;
  author?: string;
  tags: string[];
  view_count: number;
  download_count: number;
  created_at: string;
  thumbnail_url?: string;
  url?: string;
}

interface FilterState {
  resourceType: string | null;
  sortBy: 'latest' | 'most_viewed' | 'most_downloaded';
  pdfOnly: boolean;
}
```

## Analytics

### Metrics Tracked

1. **View Count**: Per resource
2. **Download Count**: Per resource
3. **Search Queries**: Via trending endpoint
4. **Resource Popularity**: Combined view + download count

### Trending Resources Endpoint

**Returns resources from last N days sorted by:**
```
engagement_score = view_count + download_count
```

**Use Cases:**
- "What's trending" section
- Popular resources recommendation
- Admin dashboard analytics

## Search Examples

### Example 1: Find DBMS Past Papers
```
GET /api/search?q=DBMS&resource_type=papers&year=2080&sort_by=most_viewed
```

### Example 2: Search for Study Notes
```
GET /api/search?q=mathematics&resource_type=notes&sort_by=latest&limit=10
```

### Example 3: Find Local Videos
```
GET /api/search?q=kinematics&resource_type=videos&sort_by=most_downloaded
```

### Example 4: Search TU Assignments
```
GET /api/search?q=TU&resource_type=assignments&sort_by=latest
```

### Example 5: Get Trending Resources
```
GET /api/analytics/trending?days=7&limit=20
```

## Performance Considerations

1. **Index Strategy:**
   - Index on `node_id` for category filtering
   - Index on `year` for year filtering
   - Text index on `title`, `description`, `content`, `tags`

2. **Aggregation Pipeline:**
   - Limit to 100 documents per collection
   - Use projection to reduce data transfer
   - Server-side sorting before combining

3. **Caching:**
   - Client-side result caching (1 hour TTL)
   - Most common searches cached
   - Offline access via local cache

4. **Pagination:**
   - Default limit: 50 results
   - Max limit: 100 results
   - Future: Offset-based pagination

## Security Considerations

1. **Query Validation:**
   - Min 3 characters for keyword search
   - Max length: 200 characters
   - Regex escape special characters

2. **Rate Limiting:**
   - Consider rate limiting search endpoint
   - Max 100 requests per user per hour

3. **Data Privacy:**
   - Anonymous search tracking
   - No personally identifiable info in queries
   - Comply with data protection regulations

## Future Enhancements

1. **Advanced Search:**
   - Boolean operators (AND, OR, NOT)
   - Fuzzy search for typo tolerance
   - Autocomplete suggestions

2. **Search Analytics:**
   - Track popular search queries
   - Recommend resources based on searches
   - Analytics dashboard

3. **Saved Searches:**
   - Save favorite searches
   - Notification on new resources matching search
   - Search history

4. **Filters Refinement:**
   - Level filter (Class 9, 10, Bachelor, Master)
   - Rating/review filter
   - Author filter

5. **Trending Section:**
   - "What's Hot" in dashboard
   - Top searches
   - Popular teachers/authors

## Files Modified/Created

### Backend
- `backend/resource_models.py` - Added view_count, download_count, SearchResult model
- `backend/server.py` - Added search endpoints and tracking endpoints

### Frontend
- `frontend/app/search.tsx` - New search screen component
- `frontend/app/_layout.tsx` - Added search route to stack
- `frontend/app/(tabs)/dashboard.tsx` - Added global search bar

## Testing Checklist

- [ ] Search with keywords
- [ ] Filter by resource type
- [ ] Sort by different options
- [ ] PDF only filter works
- [ ] View tracking increments view_count
- [ ] Download tracking increments download_count
- [ ] Trending endpoint returns correct resources
- [ ] Cache works for repeated searches
- [ ] Offline access to cached results
- [ ] Search bar in dashboard opens search screen
- [ ] Initial query passed to search screen
- [ ] Results display correctly formatted
- [ ] Tags display properly
- [ ] Date formatting works
- [ ] Pagination works (if implemented)

## Troubleshooting

### Common Issues

1. **Search returns no results:**
   - Check search query is > 2 characters
   - Verify resource exists in database
   - Check filters aren't too restrictive

2. **View/download count not incrementing:**
   - Verify endpoint is called after resource open
   - Check resource_id is correct
   - Verify resource exists in correct collection

3. **Trending endpoint slow:**
   - Add index on created_at
   - Reduce `days` parameter
   - Implement caching for trending results

4. **Search cache not updating:**
   - Check cache TTL (default 1 hour)
   - Use manual refresh button
   - Clear app data to reset cache

