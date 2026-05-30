"""Database models and schemas for Question Bank resources."""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ExamType(str, Enum):
    REGULAR = "regular"
    BACK = "back"
    INTERNAL = "internal"


class PastQuestionPaper(BaseModel):
    paper_id: str = Field(default_factory=lambda: f"paper_{datetime.now().timestamp()}")
    node_id: str  # Reference to question-bank node (e.g., "subject-c-programming")
    title: str
    year: int
    semester: Optional[int] = None
    exam_type: ExamType = ExamType.REGULAR
    pdf_url: str  # URL to PDF file
    pdf_file_size: int  # in bytes
    downloadable: bool = True
    preview_in_app: bool = True
    question_count: int = 0
    view_count: int = 0
    download_count: int = 0
    submitted_by: Optional[str] = None  # user_id of submitter (teacher/admin)
    submitted_by_name: Optional[str] = None
    approved: bool = True  # admin approval status; seeded content is approved
    featured: bool = False
    featured_until: Optional[str] = None  # ISO date until when featured
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class StudyNote(BaseModel):
    note_id: str = Field(default_factory=lambda: f"note_{datetime.now().timestamp()}")
    node_id: str  # Reference to question-bank node
    chapter_id: Optional[str] = None  # If chapter-specific
    title: str
    content: str  # Markdown/rich text content
    author: str  # Teacher/creator name
    author_email: Optional[EmailStr] = None
    tags: List[str] = []
    downloadable_pdf: bool = True
    pdf_url: Optional[str] = None
    markdown: bool = True  # True if markdown, False if rich text
    view_count: int = 0
    download_count: int = 0
    submitted_by: Optional[str] = None
    submitted_by_name: Optional[str] = None
    approved: bool = True
    featured: bool = False
    featured_until: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class VideoSolution(BaseModel):
    video_id: str = Field(default_factory=lambda: f"video_{datetime.now().timestamp()}")
    node_id: str  # Reference to question-bank node
    chapter_id: Optional[str] = None
    question_id: Optional[str] = None  # If tied to specific question
    title: str
    description: str
    video_url: str  # YouTube URL or uploaded video URL
    video_type: str = "youtube"  # "youtube" or "uploaded"
    duration_seconds: int = 0
    thumbnail_url: Optional[str] = None
    chapter_mapping: Optional[Dict[str, Any]] = None  # {"chapter": "ch_see_math_1", "topics": ["algebra", "equations"]}
    timestamp_chapters: List[Dict[str, Any]] = []  # [{"time": 120, "chapter": "Introduction to Algebra"}]
    view_count: int = 0
    download_count: int = 0
    submitted_by: Optional[str] = None
    submitted_by_name: Optional[str] = None
    approved: bool = True
    featured: bool = False
    featured_until: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ImportanceTag(str, Enum):
    VERY_IMPORTANT = "very_important"
    REPEATED_IN_EXAM = "repeated_in_exam"
    LIKELY_EXAM_QUESTION = "likely_exam_question"


class ImportantQuestion(BaseModel):
    importance_id: str = Field(default_factory=lambda: f"imp_{datetime.now().timestamp()}")
    question_id: str  # Reference to existing question
    node_id: str  # Reference to question-bank node
    importance_tags: List[ImportanceTag] = []
    reason: Optional[str] = None  # Why this question is important
    frequency_in_exams: int = 0  # Number of times appeared
    last_appeared_year: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class AssignmentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class StudentSubmission(BaseModel):
    submission_id: str = Field(default_factory=lambda: f"sub_{datetime.now().timestamp()}")
    assignment_id: str
    student_id: str
    submission_url: str  # URL to submitted file
    submission_text: Optional[str] = None  # If text submission
    submitted_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    graded: bool = False
    grade: Optional[float] = None
    feedback: Optional[str] = None
    graded_at: Optional[str] = None
    teacher_replies: List[Dict[str, Any]] = []  # {teacher_id, teacher_name, message, created_at}


class Assignment(BaseModel):
    assignment_id: str = Field(default_factory=lambda: f"assign_{datetime.now().timestamp()}")
    node_id: str  # Reference to question-bank node
    chapter_id: Optional[str] = None
    title: str
    description: str
    instructions: str
    posted_by_teacher: str  # Teacher email or ID
    posted_by_name: str
    due_date: str  # ISO format date
    file_url: Optional[str] = None  # Assignment file/PDF
    total_points: Optional[float] = None
    status: AssignmentStatus = AssignmentStatus.PUBLISHED
    submissions: List[StudentSubmission] = []
    view_count: int = 0
    download_count: int = 0
    submitted_by: Optional[str] = None
    submitted_by_name: Optional[str] = None
    approved: bool = True
    featured: bool = False
    featured_until: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ResourceStats(BaseModel):
    """Stats aggregations for a question-bank node."""
    node_id: str
    past_papers_count: int = 0
    notes_count: int = 0
    videos_count: int = 0
    important_questions_count: int = 0
    assignments_count: int = 0
    total_resources: int = 0
    last_updated: str = Field(default_factory=lambda: datetime.now().isoformat())


class SearchResult(BaseModel):
    """Unified search result across all resource types."""
    resource_type: str  # "paper", "note", "video", "assignment"
    resource_id: str
    title: str
    description: Optional[str] = None
    node_id: str
    year: Optional[int] = None
    semester: Optional[int] = None
    exam_type: Optional[str] = None
    author: Optional[str] = None
    tags: List[str] = []
    view_count: int = 0
    download_count: int = 0
    created_at: str
    thumbnail_url: Optional[str] = None
    url: Optional[str] = None
