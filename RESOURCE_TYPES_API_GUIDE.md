# Resource Types API Quick Reference

## Base URL
```
http://localhost:8000/api
```

---

## 📄 Past Question Papers

### GET - List Papers
```bash
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/past-papers"
```

**Response:**
```json
[
  {
    "paper_id": "pp_001",
    "node_id": "subject-c-programming",
    "title": "BIT 3rd Semester DBMS 2080",
    "year": 2080,
    "semester": 3,
    "exam_type": "regular",
    "pdf_url": "https://example.com/bit3-dbms-2080.pdf",
    "question_count": 8,
    "downloadable": true,
    "preview_in_app": true
  }
]
```

---

## 📚 Study Notes

### GET - List Notes (All or by Chapter)
```bash
# Get all notes for subject
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/notes"

# Get notes for specific chapter
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/notes?chapter_id=ch_see_math_1"
```

**Response:**
```json
[
  {
    "note_id": "note_001",
    "node_id": "subject-c-programming",
    "chapter_id": null,
    "title": "C Programming Fundamentals",
    "author": "Prof. Ram Sharma",
    "author_email": "ram@example.com",
    "tags": ["basics", "syntax"],
    "downloadable_pdf": true,
    "pdf_url": "https://example.com/c-basics.pdf",
    "markdown": true
  }
]
```

---

## 🎥 Video Solutions

### GET - List Videos
```bash
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/videos"
```

**Response:**
```json
[
  {
    "video_id": "vid_001",
    "node_id": "subject-c-programming",
    "title": "C Loops Tutorial",
    "description": "Complete guide to loops in C programming",
    "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "video_type": "youtube",
    "duration_seconds": 1200,
    "chapter_mapping": {
      "chapter": "loops",
      "topics": ["for", "while", "do-while"]
    },
    "timestamp_chapters": [
      {"time": 0, "chapter": "Introduction"},
      {"time": 120, "chapter": "For Loops"}
    ]
  }
]
```

---

## ⭐ Important Questions

### GET - List Important Questions
```bash
curl -X GET "http://localhost:8000/api/resources/subject-mathematics/important-questions"
```

**Response:**
```json
[
  {
    "importance_id": "imp_001",
    "question_id": "q_001",
    "node_id": "subject-mathematics",
    "importance_tags": ["very_important", "repeated_in_exam"],
    "reason": "Set theory is foundational and appears in every exam",
    "frequency_in_exams": 5,
    "last_appeared_year": 2080
  }
]
```

**Importance Tags:**
- `very_important` - Critical concept
- `repeated_in_exam` - Appeared multiple times
- `likely_exam_question` - Frequently tested

---

## ✏️ Assignments

### GET - List Assignments
```bash
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/assignments"
```

### POST - Create Assignment (Teacher Only)
```bash
curl -X POST "http://localhost:8000/api/resources/assignments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "subject-c-programming",
    "chapter_id": null,
    "title": "Calculate Sum of Digits",
    "description": "Write a C program to calculate the sum of digits",
    "instructions": "1. Write a function\n2. Calculate sum\n3. Return result",
    "due_date": "2081-06-15T23:59:59",
    "file_url": "https://example.com/assignment1.pdf",
    "total_points": 10.0
  }'
```

**Response:**
```json
{
  "assignment_id": "assign_001",
  "success": true
}
```

### POST - Submit Assignment (Student)
```bash
curl -X POST "http://localhost:8000/api/resources/assignments/assign_001/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_url": "https://example.com/solution.c",
    "submission_text": "Optional text submission"
  }'
```

**Response:**
```json
{
  "submission_id": "sub_001",
  "success": true
}
```

### GET - View Submissions (Teacher)
```bash
curl -X GET "http://localhost:8000/api/resources/assignments/assign_001/submissions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "submission_id": "sub_001",
    "student_id": "user_123",
    "submission_url": "https://example.com/solution.c",
    "submitted_at": "2081-06-14T15:30:00",
    "graded": false,
    "grade": null,
    "feedback": null
  }
]
```

---

## 📊 Resource Statistics

### GET - Overview Stats
```bash
curl -X GET "http://localhost:8000/api/resources/subject-c-programming/stats"
```

**Response:**
```json
{
  "node_id": "subject-c-programming",
  "past_papers_count": 2,
  "notes_count": 1,
  "videos_count": 1,
  "important_questions_count": 0,
  "assignments_count": 1,
  "total_resources": 5
}
```

---

## Error Responses

### 404 - Not Found
```json
{
  "detail": "Assignment not found"
}
```

### 401 - Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 400 - Bad Request
```json
{
  "detail": "Invalid request parameters"
}
```

---

## Data Models

### ExamType Enum
- `regular` - Standard exam
- `back` - Back exam/supplementary
- `internal` - Internal exam

### ImportanceTag Enum
- `very_important` - Must know concept
- `repeated_in_exam` - Appears frequently  
- `likely_exam_question` - Probably on exam

### AssignmentStatus Enum
- `draft` - Not published yet
- `published` - Visible to students
- `closed` - No more submissions

---

## Implementation Examples

### JavaScript/Fetch
```javascript
// Get past papers
const papers = await fetch('http://localhost:8000/api/resources/subject-c-programming/past-papers')
  .then(r => r.json());

// Submit assignment
await fetch('http://localhost:8000/api/resources/assignments/assign_001/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    submission_url: 'https://example.com/solution.c'
  })
});
```

### Python
```python
import requests

# Get videos
response = requests.get(
  'http://localhost:8000/api/resources/subject-c-programming/videos'
)
videos = response.json()

# Create assignment
assignment = requests.post(
  'http://localhost:8000/api/resources/assignments',
  headers={'Authorization': f'Bearer {token}'},
  json={
    'node_id': 'subject-c-programming',
    'title': 'Problem Set 1',
    'due_date': '2081-06-15T23:59:59',
    'total_points': 10.0
  }
)
```

---

## Caching

All resource endpoints support client-side caching via `fetchWithCache`:

```typescript
const papers = await fetchWithCache<PastPaper[]>(
  `resources-papers-${nodeId}`,
  () => api.get(`/resources/${nodeId}/past-papers`),
  { ttl: 86400 } // 24 hours
);
```

---

## Deployment Notes

- Seed data is loaded automatically on server startup
- All resources are tied to `node_id` (subject/chapter hierarchy)
- Teacher authentication required for assignment creation
- Student ID captured from JWT on submission
- File URLs point to external storage (configure CDN in production)

---

**Last Updated:** May 30, 2026

