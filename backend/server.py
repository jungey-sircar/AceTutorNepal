"""
ExamAce Nepal - Backend Server
AI-powered exam preparation platform for Nepali students
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import httpx
import random
import string
from emergentintegrations.llm.chat import LlmChat, UserMessage
try:
    from question_bank import get_question_bank_node, get_question_bank_roots
except ImportError:  # pragma: no cover - fallback for package-style imports
    from .question_bank import get_question_bank_node, get_question_bank_roots

ROOT_DIR = Path(__file__).parent

try:
    from resource_models import (
        PastQuestionPaper, StudyNote, VideoSolution, ImportantQuestion,
        Assignment, StudentSubmission, ResourceStats, SearchResult
    )
except ImportError:
    from .resource_models import (
        PastQuestionPaper, StudyNote, VideoSolution, ImportantQuestion,
        Assignment, StudentSubmission, ResourceStats, SearchResult
    )
load_dotenv(ROOT_DIR / '.env')

# Config
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'examace-fallback-secret')
JWT_ALGORITHM = 'HS256'
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
AWS_S3_BUCKET = os.environ.get('AWS_S3_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))

# MongoDB
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# App
app = FastAPI(title="ExamAce Nepal API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== PYDANTIC MODELS ====================

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    exam_type: str = "SEE"
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    name: str
    email: str
    exam_type: str
    subscription_status: str = "free"
    daily_streak: int = 0
    referral_code: str = ""
    premium_expires: Optional[str] = None

class ApplyReferralRequest(BaseModel):
    referral_code: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class SubmitAnswerRequest(BaseModel):
    question_id: str
    selected_answer: int
    time_taken: int = 0

class AIChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    subject_context: Optional[str] = None
    topic_context: Optional[str] = None

class AIExplainRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[int] = None

class AIGenerateQuizRequest(BaseModel):
    subject: str
    topic: Optional[str] = None
    difficulty: str = "medium"
    count: int = 5

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=168),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(401, 'Not authenticated')
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({'user_id': payload['sub']}, {'_id': 0})
        if not user:
            raise HTTPException(401, 'User not found')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(401, 'Invalid token')

async def update_streak(user_id: str):
    user = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    if not user:
        return
    last_active = user.get('last_active', '')
    now = datetime.now(timezone.utc)
    today = now.date()

    if last_active:
        try:
            last_date = datetime.fromisoformat(last_active).date()
            diff = (today - last_date).days
            if diff == 1:
                new_streak = user.get('daily_streak', 0) + 1
            elif diff == 0:
                new_streak = user.get('daily_streak', 0)
            else:
                new_streak = 1
        except (ValueError, TypeError):
            new_streak = 1
    else:
        new_streak = 1

    await db.users.update_one(
        {'user_id': user_id},
        {'$set': {'daily_streak': new_streak, 'last_active': now.isoformat()}}
    )

def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def grant_premium(user_id: str, days: int = 7):
    expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    await db.users.update_one(
        {'user_id': user_id},
        {'$set': {'subscription_status': 'premium', 'premium_expires': expires}}
    )

def build_user_response(user: dict) -> UserResponse:
    return UserResponse(
        user_id=user['user_id'], name=user['name'], email=user['email'],
        exam_type=user.get('exam_type', 'SEE'),
        subscription_status=user.get('subscription_status', 'free'),
        daily_streak=user.get('daily_streak', 0),
        referral_code=user.get('referral_code', ''),
        premium_expires=user.get('premium_expires'),
    )

# ==================== AUTH ROUTES ====================

@api.post("/auth/register", response_model=TokenResponse)
async def register(data: UserRegister):
    existing = await db.users.find_one({'email': data.email}, {'_id': 0})
    if existing:
        raise HTTPException(400, 'Email already registered')

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    referral_code = generate_referral_code()
    # Ensure unique referral code
    while await db.users.find_one({'referral_code': referral_code}, {'_id': 0}):
        referral_code = generate_referral_code()

    user_doc = {
        'user_id': user_id,
        'name': data.name,
        'email': data.email,
        'password_hash': hash_password(data.password),
        'exam_type': data.exam_type,
        'subscription_status': 'free',
        'daily_streak': 1,
        'referral_code': referral_code,
        'referred_by': None,
        'referral_count': 0,
        'premium_expires': None,
        'last_active': datetime.now(timezone.utc).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    # Handle referral code from registration
    if data.referral_code:
        referrer = await db.users.find_one({'referral_code': data.referral_code.upper()}, {'_id': 0})
        if referrer and referrer['user_id'] != user_id:
            await db.users.update_one({'user_id': user_id}, {'$set': {'referred_by': referrer['user_id']}})
            await db.users.update_one({'user_id': referrer['user_id']}, {'$inc': {'referral_count': 1}})
            await grant_premium(user_id, 7)
            await grant_premium(referrer['user_id'], 7)
            user_doc['subscription_status'] = 'premium'

    token = create_token(user_id)
    return TokenResponse(
        token=token,
        user=UserResponse(
            user_id=user_id, name=data.name, email=data.email,
            exam_type=data.exam_type,
            subscription_status=user_doc.get('subscription_status', 'free'),
            daily_streak=1, referral_code=referral_code,
        )
    )

@api.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({'email': data.email}, {'_id': 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(401, 'Invalid email or password')

    await update_streak(user['user_id'])
    updated = await db.users.find_one({'user_id': user['user_id']}, {'_id': 0})

    token = create_token(user['user_id'])
    return TokenResponse(token=token, user=build_user_response(updated))

@api.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return build_user_response(user)

# ==================== REFERRAL ROUTES ====================

@api.get("/referral/info")
async def get_referral_info(user: dict = Depends(get_current_user)):
    referral_count = user.get('referral_count', 0)
    referred_users = await db.users.find(
        {'referred_by': user['user_id']}, {'_id': 0, 'name': 1, 'created_at': 1}
    ).to_list(50)
    return {
        'referral_code': user.get('referral_code', ''),
        'referral_count': referral_count,
        'referred_users': referred_users,
        'subscription_status': user.get('subscription_status', 'free'),
        'premium_expires': user.get('premium_expires'),
    }

@api.post("/referral/apply")
async def apply_referral(data: ApplyReferralRequest, user: dict = Depends(get_current_user)):
    if user.get('referred_by'):
        raise HTTPException(400, 'You have already used a referral code')

    code = data.referral_code.strip().upper()
    referrer = await db.users.find_one({'referral_code': code}, {'_id': 0})
    if not referrer:
        raise HTTPException(404, 'Invalid referral code')
    if referrer['user_id'] == user['user_id']:
        raise HTTPException(400, 'You cannot use your own referral code')

    await db.users.update_one({'user_id': user['user_id']}, {'$set': {'referred_by': referrer['user_id']}})
    await db.users.update_one({'user_id': referrer['user_id']}, {'$inc': {'referral_count': 1}})
    await grant_premium(user['user_id'], 7)
    await grant_premium(referrer['user_id'], 7)

    updated_user = await db.users.find_one({'user_id': user['user_id']}, {'_id': 0})
    return {
        'success': True,
        'message': 'Referral applied! Both you and your friend get 1 week premium.',
        'user': build_user_response(updated_user).model_dump(),
    }

# ==================== OFFLINE CACHE ROUTES ====================

@api.get("/cache/content")
async def get_cacheable_content(exam_id: Optional[str] = None):
    """Return all content for offline caching in a single request."""
    query = {'exam_id': exam_id} if exam_id else {}
    subjects = await db.subjects.find(query, {'_id': 0}).to_list(100)
    subject_ids = [s['subject_id'] for s in subjects]

    chapters = await db.chapters.find({'subject_id': {'$in': subject_ids}}, {'_id': 0}).sort('order', 1).to_list(500)
    chapter_ids = [c['chapter_id'] for c in chapters]

    questions = await db.questions.find({'chapter_id': {'$in': chapter_ids}}, {'_id': 0}).to_list(5000)

    return {
        'subjects': subjects,
        'chapters': chapters,
        'questions': questions,
        'question_bank': get_question_bank_roots(),
        'cached_at': datetime.now(timezone.utc).isoformat(),
    }

# ==================== QUESTION BANK ROUTES ====================

@api.get("/question-bank")
async def get_question_bank_roots_endpoint():
    return get_question_bank_roots()


@api.get("/question-bank/{node_id}")
async def get_question_bank_node_endpoint(node_id: str):
    node = get_question_bank_node(node_id)
    if not node:
        raise HTTPException(404, 'Question bank node not found')
    return node

# Google OAuth
# ==================== RESOURCE ENDPOINTS ====================

@api.get("/resources/{node_id}/past-papers")
async def get_past_papers(node_id: str):
    papers = await db.past_papers.find({'node_id': node_id}, {'_id': 0}).sort('year', -1).to_list(100)
    return papers

@api.get("/resources/{node_id}/notes")
async def get_notes(node_id: str, chapter_id: Optional[str] = None):
    query = {'node_id': node_id}
    if chapter_id:
        query['chapter_id'] = chapter_id
    notes = await db.study_notes.find(query, {'_id': 0}).to_list(100)
    return notes

@api.get("/resources/{node_id}/videos")
async def get_video_solutions(node_id: str):
    videos = await db.video_solutions.find({'node_id': node_id}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return videos

@api.get("/resources/{node_id}/important-questions")
async def get_important_questions(node_id: str):
    questions = await db.important_questions.find({'node_id': node_id}, {'_id': 0}).sort('frequency_in_exams', -1).to_list(100)
    return questions

@api.get("/resources/{node_id}/assignments")
async def get_assignments(node_id: str):
    assignments = await db.assignments.find({'node_id': node_id}, {'_id': 0}).sort('due_date', 1).to_list(100)
    return assignments

@api.get("/resources/{node_id}/stats")
async def get_resource_stats(node_id: str):
    papers_count = await db.past_papers.count_documents({'node_id': node_id})
    notes_count = await db.study_notes.count_documents({'node_id': node_id})
    videos_count = await db.video_solutions.count_documents({'node_id': node_id})
    imp_q_count = await db.important_questions.count_documents({'node_id': node_id})
    assign_count = await db.assignments.count_documents({'node_id': node_id})
    return {
        'node_id': node_id,
        'past_papers_count': papers_count,
        'notes_count': notes_count,
        'videos_count': videos_count,
        'important_questions_count': imp_q_count,
        'assignments_count': assign_count,
        'total_resources': papers_count + notes_count + videos_count + imp_q_count + assign_count,
    }

@api.post("/resources/assignments")
async def create_assignment(data: dict, user: dict = Depends(get_current_user)):
    assignment = {
        'assignment_id': f"assign_{uuid.uuid4().hex[:12]}",
        'node_id': data.get('node_id', ''),
        'chapter_id': data.get('chapter_id'),
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'instructions': data.get('instructions', ''),
        'posted_by_teacher': user['email'],
        'posted_by_name': user['name'],
        'due_date': data.get('due_date', ''),
        'file_url': data.get('file_url'),
        'total_points': data.get('total_points'),
        'status': 'published',
        'submissions': [],
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.assignments.insert_one(assignment)
    return {'assignment_id': assignment['assignment_id'], 'success': True}

@api.post("/resources/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: str, data: dict, user: dict = Depends(get_current_user)):
    assignment = await db.assignments.find_one({'assignment_id': assignment_id}, {'_id': 0})
    if not assignment:
        raise HTTPException(404, 'Assignment not found')
    submission = {
        'submission_id': f"sub_{uuid.uuid4().hex[:12]}",
        'assignment_id': assignment_id,
        'student_id': user['user_id'],
        'submission_url': data.get('submission_url', ''),
        'submission_text': data.get('submission_text'),
        'submitted_at': datetime.now(timezone.utc).isoformat(),
        'graded': False,
    }
    await db.student_submissions.insert_one(submission)
    await db.assignments.update_one({'assignment_id': assignment_id}, {'$push': {'submissions': submission}})
    return {'submission_id': submission['submission_id'], 'success': True}

@api.get("/resources/assignments/{assignment_id}/submissions")
async def get_assignment_submissions(assignment_id: str, user: dict = Depends(get_current_user)):
    submissions = await db.student_submissions.find({'assignment_id': assignment_id}, {'_id': 0}).sort('submitted_at', -1).to_list(500)
    return submissions

# ==================== SEARCH & ANALYTICS ENDPOINTS ====================

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
    """Global search across all resource types with keyword and field filtering."""
    conditions = []

    if q:
        conditions.append({
            '$or': [
                {'title': {'$regex': q, '$options': 'i'}},
                {'description': {'$regex': q, '$options': 'i'}},
                {'content': {'$regex': q, '$options': 'i'}},
                {'tags': {'$elemMatch': {'$regex': q, '$options': 'i'}}}
            ]
        })

    if subject:
        conditions.append({'node_id': {'$regex': subject.lower(), '$options': 'i'}})

    if year:
        conditions.append({'year': year})

    if semester:
        conditions.append({'semester': semester})

    sort_spec = []
    if sort_by == "most_viewed":
        sort_spec = [('view_count', -1)]
    elif sort_by == "most_downloaded":
        sort_spec = [('download_count', -1)]
    else:
        sort_spec = [('created_at', -1)]

    query = {'$and': conditions} if conditions else {}
    results = []

    if not resource_type or resource_type == "papers":
        papers = await db.past_papers.find(query, {'_id': 0}).sort(*sort_spec).to_list(limit)
        for paper in papers:
            results.append({
                'resource_type': 'paper',
                'resource_id': paper.get('paper_id'),
                'title': paper.get('title'),
                'description': f"{paper.get('exam_type', 'Regular')} - {paper.get('year')}",
                'node_id': paper.get('node_id'),
                'year': paper.get('year'),
                'semester': paper.get('semester'),
                'exam_type': paper.get('exam_type'),
                'view_count': paper.get('view_count', 0),
                'download_count': paper.get('download_count', 0),
                'created_at': paper.get('created_at'),
                'url': paper.get('pdf_url'),
                'tags': ['pdf', paper.get('exam_type', '')],
            })

    if not resource_type or resource_type == "notes":
        notes = await db.study_notes.find(query, {'_id': 0}).sort(*sort_spec).to_list(limit)
        for note in notes:
            results.append({
                'resource_type': 'note',
                'resource_id': note.get('note_id'),
                'title': note.get('title'),
                'description': f"By {note.get('author', 'Unknown')}",
                'node_id': note.get('node_id'),
                'author': note.get('author'),
                'view_count': note.get('view_count', 0),
                'download_count': note.get('download_count', 0),
                'created_at': note.get('created_at'),
                'url': note.get('pdf_url'),
                'tags': note.get('tags', []) + ['note'],
            })

    if not resource_type or resource_type == "videos":
        videos = await db.video_solutions.find(query, {'_id': 0}).sort(*sort_spec).to_list(limit)
        for video in videos:
            results.append({
                'resource_type': 'video',
                'resource_id': video.get('video_id'),
                'title': video.get('title'),
                'description': video.get('description', ''),
                'node_id': video.get('node_id'),
                'view_count': video.get('view_count', 0),
                'download_count': video.get('download_count', 0),
                'created_at': video.get('created_at'),
                'thumbnail_url': video.get('thumbnail_url'),
                'url': video.get('video_url'),
                'tags': ['video', video.get('video_type', 'youtube')],
            })

    if not resource_type or resource_type == "assignments":
        assignments = await db.assignments.find(query, {'_id': 0}).sort(*sort_spec).to_list(limit)
        for assignment in assignments:
            results.append({
                'resource_type': 'assignment',
                'resource_id': assignment.get('assignment_id'),
                'title': assignment.get('title'),
                'description': f"Due {assignment.get('due_date', 'N/A')}",
                'node_id': assignment.get('node_id'),
                'author': assignment.get('posted_by_name'),
                'view_count': assignment.get('view_count', 0),
                'download_count': assignment.get('download_count', 0),
                'created_at': assignment.get('created_at'),
                'url': assignment.get('file_url'),
                'tags': ['assignment', assignment.get('status', '')],
            })

    if sort_by == "most_viewed":
        results.sort(key=lambda x: x['view_count'], reverse=True)
    elif sort_by == "most_downloaded":
        results.sort(key=lambda x: x['download_count'], reverse=True)
    else:
        results.sort(key=lambda x: x['created_at'], reverse=True)

    return results[:limit]


@api.get("/uploads/signed-url")
async def get_s3_signed_url(file_name: str, content_type: str = 'application/octet-stream', acl: str = 'private'):
    """Generate a presigned PUT URL for direct S3 uploads.
    Returns upload_url, object_key and optional public_url when acl is public-read.
    """
    if not AWS_S3_BUCKET:
        raise HTTPException(500, 'S3 bucket not configured')

    s3_client = None
    try:
        import boto3
        s3_client = boto3.client('s3', region_name=AWS_REGION)
    except Exception as e:
        logger.error(f"S3 client init error: {e}")
        raise HTTPException(500, 'S3 client initialization failed')

    # Create a safe object key
    key = f"uploads/{uuid.uuid4().hex}_{os.path.basename(file_name)}"
    try:
        params = {'Bucket': AWS_S3_BUCKET, 'Key': key, 'ContentType': content_type}
        if acl:
            params['ACL'] = acl
        upload_url = s3_client.generate_presigned_url('put_object', Params=params, ExpiresIn=3600)
        public_url = None
        if acl == 'public-read':
            public_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
        return {'upload_url': upload_url, 'object_key': key, 'public_url': public_url, 'expires_in': 3600}
    except Exception as e:
        logger.error(f"Error generating presigned url: {e}")
        raise HTTPException(500, 'Failed to generate presigned url')


@api.post("/uploads/complete")
async def complete_upload(data: dict, user: dict = Depends(get_current_user)):
    """Register a completed upload. Expects { object_key, public_url?, file_name?, content_type? }.
    Verifies object exists in S3 when bucket is configured and stores metadata in `uploads` collection.
    Returns {'object_key','url','size','success': True}
    """
    object_key = data.get('object_key')
    public_url = data.get('public_url')
    file_name = data.get('file_name')
    content_type = data.get('content_type')

    if not object_key:
        raise HTTPException(400, 'object_key is required')

    size = None
    final_url = public_url

    if AWS_S3_BUCKET:
        try:
            import boto3
            s3_client = boto3.client('s3', region_name=AWS_REGION)
            head = s3_client.head_object(Bucket=AWS_S3_BUCKET, Key=object_key)
            size = int(head.get('ContentLength', 0))
            # If public_url not provided, construct one for public-read objects
            if not final_url:
                final_url = f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{object_key}"
        except Exception as e:
            logger.warning(f"S3 head_object failed for {object_key}: {e}")
            # If head_object fails, still allow registration but mark size as None
            size = None
            if not final_url:
                final_url = None
    else:
        # No S3 configured; rely on client-provided public_url or object_key
        final_url = final_url or object_key

    upload_doc = {
        'object_key': object_key,
        'url': final_url,
        'file_name': file_name,
        'content_type': content_type,
        'size': size,
        'uploaded_by': user.get('user_id') if user else None,
        'uploaded_by_name': user.get('name') if user else None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }

    try:
        await db.uploads.insert_one(upload_doc)
    except Exception:
        # If uploads collection doesn't exist or DB not configured, continue
        logger.warning('Could not write upload metadata to DB')

    return {'object_key': object_key, 'url': final_url, 'size': size, 'success': True}

@api.post("/resources/{resource_type}/{resource_id}/view")
async def track_resource_view(resource_type: str, resource_id: str):
    """Track resource view for analytics."""
    collection_map = {
        'paper': 'past_papers',
        'note': 'study_notes',
        'video': 'video_solutions',
        'assignment': 'assignments',
    }

    if resource_type not in collection_map:
        raise HTTPException(400, 'Invalid resource type')

    collection_name = collection_map[resource_type]
    id_field = {'paper': 'paper_id', 'note': 'note_id', 'video': 'video_id', 'assignment': 'assignment_id'}[resource_type]

    result = await db[collection_name].update_one({id_field: resource_id}, {'$inc': {'view_count': 1}})
    if result.matched_count == 0:
        raise HTTPException(404, 'Resource not found')
    return {'success': True}

@api.post("/resources/{resource_type}/{resource_id}/download")
async def track_resource_download(resource_type: str, resource_id: str):
    """Track resource download for analytics."""
    collection_map = {
        'paper': 'past_papers',
        'note': 'study_notes',
        'video': 'video_solutions',
        'assignment': 'assignments',
    }

    if resource_type not in collection_map:
        raise HTTPException(400, 'Invalid resource type')

    collection_name = collection_map[resource_type]
    id_field = {'paper': 'paper_id', 'note': 'note_id', 'video': 'video_id', 'assignment': 'assignment_id'}[resource_type]

    result = await db[collection_name].update_one({id_field: resource_id}, {'$inc': {'download_count': 1}})
    if result.matched_count == 0:
        raise HTTPException(404, 'Resource not found')
    return {'success': True}

@api.get("/analytics/trending")
async def get_trending_resources(days: int = 7, limit: int = 10):
    """Get trending resources based on views and downloads."""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff_date.isoformat()
    query = {'created_at': {'$gte': cutoff_iso}}
    sort_by = [('view_count', -1), ('download_count', -1)]

    results = []
    papers = await db.past_papers.find(query, {'_id': 0}).sort(*sort_by).to_list(limit)
    results.extend([{'type': 'paper', **p} for p in papers])

    notes = await db.study_notes.find(query, {'_id': 0}).sort(*sort_by).to_list(limit)
    results.extend([{'type': 'note', **n} for n in notes])

    videos = await db.video_solutions.find(query, {'_id': 0}).sort(*sort_by).to_list(limit)
    results.extend([{'type': 'video', **v} for v in videos])

    results.sort(key=lambda x: (x.get('view_count', 0) + x.get('download_count', 0)), reverse=True)
    return results[:limit]

# ==================== ADMIN & TEACHER ROUTES ====================


def _require_role(user: dict, allowed: List[str]):
    if not user or user.get('role') not in allowed:
        raise HTTPException(403, 'Permission denied')


@api.post("/admin/universities")
async def create_university(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    uni = {
        'university_id': data.get('university_id', f"uni_{uuid.uuid4().hex[:8]}"),
        'name': data.get('name'),
        'description': data.get('description'),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.universities.insert_one(uni)
    return {'success': True, 'university': uni}


@api.post("/admin/faculties")
async def create_faculty(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    fac = {
        'faculty_id': data.get('faculty_id', f"fac_{uuid.uuid4().hex[:8]}"),
        'name': data.get('name'),
        'university_id': data.get('university_id'),
        'description': data.get('description'),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.faculties.insert_one(fac)
    return {'success': True, 'faculty': fac}


@api.post("/admin/categories")
async def create_category(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    cat = {
        'category_id': data.get('category_id', f"cat_{uuid.uuid4().hex[:8]}"),
        'title': data.get('title'),
        'parent_id': data.get('parent_id'),
        'meta': data.get('meta', {}),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.categories.insert_one(cat)
    return {'success': True, 'category': cat}


@api.post("/admin/resources/{resource_type}/{resource_id}/feature")
async def feature_resource(resource_type: str, resource_id: str, data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    collection_map = {
        'paper': 'past_papers',
        'note': 'study_notes',
        'video': 'video_solutions',
        'assignment': 'assignments'
    }
    if resource_type not in collection_map:
        raise HTTPException(400, 'Invalid resource type')
    collection = collection_map[resource_type]
    update = {'$set': {'featured': bool(data.get('featured', True))}}
    if data.get('featured_until'):
        update['$set']['featured_until'] = data.get('featured_until')
    await db[collection].update_one({f"{resource_type}_id": resource_id} if resource_type != 'paper' else {'paper_id': resource_id}, update)
    return {'success': True}


@api.post("/admin/resources/{resource_type}/{resource_id}/approve")
async def approve_resource(resource_type: str, resource_id: str, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    collection_map = {
        'paper': 'past_papers',
        'note': 'study_notes',
        'video': 'video_solutions',
        'assignment': 'assignments'
    }
    if resource_type not in collection_map:
        raise HTTPException(400, 'Invalid resource type')
    collection = collection_map[resource_type]
    id_field = {'paper': 'paper_id', 'note': 'note_id', 'video': 'video_id', 'assignment': 'assignment_id'}[resource_type]
    result = await db[collection].update_one({id_field: resource_id}, {'$set': {'approved': True}})
    if result.matched_count == 0:
        raise HTTPException(404, 'Resource not found')
    return {'success': True}


@api.patch("/admin/resources/{resource_type}/{resource_id}")
async def edit_resource_metadata(resource_type: str, resource_id: str, data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    collection_map = {
        'paper': 'past_papers',
        'note': 'study_notes',
        'video': 'video_solutions',
        'assignment': 'assignments'
    }
    if resource_type not in collection_map:
        raise HTTPException(400, 'Invalid resource type')
    collection = collection_map[resource_type]
    id_field = {'paper': 'paper_id', 'note': 'note_id', 'video': 'video_id', 'assignment': 'assignment_id'}[resource_type]
    update = {'$set': data}
    result = await db[collection].update_one({id_field: resource_id}, update)
    if result.matched_count == 0:
        raise HTTPException(404, 'Resource not found')
    return {'success': True}


@api.get("/admin/pending-uploads")
async def list_pending_uploads(user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    pending = {}
    pending['papers'] = await db.past_papers.find({'approved': False}, {'_id': 0}).to_list(100)
    pending['notes'] = await db.study_notes.find({'approved': False}, {'_id': 0}).to_list(100)
    pending['videos'] = await db.video_solutions.find({'approved': False}, {'_id': 0}).to_list(100)
    pending['assignments'] = await db.assignments.find({'approved': False}, {'_id': 0}).to_list(100)
    return pending


@api.post("/admin/users/{user_id}/role")
async def set_user_role(user_id: str, data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['admin'])
    role = data.get('role')
    if role not in ['admin', 'teacher', 'student']:
        raise HTTPException(400, 'Invalid role')
    result = await db.users.update_one({'user_id': user_id}, {'$set': {'role': role}})
    if result.matched_count == 0:
        raise HTTPException(404, 'User not found')
    return {'success': True, 'user_id': user_id, 'role': role}


@api.post("/teacher/notes")
async def teacher_upload_note(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['teacher', 'admin'])
    note = {
        'note_id': f"note_{uuid.uuid4().hex[:12]}",
        'node_id': data.get('node_id', ''),
        'chapter_id': data.get('chapter_id'),
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'author': user.get('name', ''),
        'author_email': user.get('email'),
        'tags': data.get('tags', []),
        'downloadable_pdf': data.get('downloadable_pdf', True),
        'pdf_url': data.get('pdf_url'),
        'markdown': data.get('markdown', True),
        'view_count': 0,
        'download_count': 0,
        'submitted_by': user.get('user_id'),
        'submitted_by_name': user.get('name'),
        'approved': False,
        'featured': False,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.study_notes.insert_one(note)
    return {'note_id': note['note_id'], 'success': True}


@api.post("/teacher/papers")
async def teacher_upload_paper(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['teacher', 'admin'])
    paper = {
        'paper_id': f"paper_{uuid.uuid4().hex[:12]}",
        'node_id': data.get('node_id', ''),
        'title': data.get('title', ''),
        'year': data.get('year', 0),
        'semester': data.get('semester'),
        'exam_type': data.get('exam_type', 'regular'),
        'pdf_url': data.get('pdf_url', ''),
        'pdf_file_size': data.get('pdf_file_size', 0),
        'downloadable': data.get('downloadable', True),
        'preview_in_app': data.get('preview_in_app', True),
        'question_count': data.get('question_count', 0),
        'view_count': 0,
        'download_count': 0,
        'submitted_by': user.get('user_id'),
        'submitted_by_name': user.get('name'),
        'approved': False,
        'featured': False,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.past_papers.insert_one(paper)
    return {'paper_id': paper['paper_id'], 'success': True}


@api.post("/teacher/assignments")
async def teacher_create_assignment(data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['teacher', 'admin'])
    assignment = {
        'assignment_id': f"assign_{uuid.uuid4().hex[:12]}",
        'node_id': data.get('node_id', ''),
        'chapter_id': data.get('chapter_id'),
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'instructions': data.get('instructions', ''),
        'posted_by_teacher': user.get('email'),
        'posted_by_name': user.get('name'),
        'due_date': data.get('due_date', ''),
        'file_url': data.get('file_url'),
        'total_points': data.get('total_points'),
        'status': data.get('status', 'published'),
        'submissions': [],
        'view_count': 0,
        'download_count': 0,
        'submitted_by': user.get('user_id'),
        'submitted_by_name': user.get('name'),
        'approved': data.get('approved', False),
        'featured': False,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.assignments.insert_one(assignment)
    return {'assignment_id': assignment['assignment_id'], 'success': True}


@api.post("/teacher/assignments/{assignment_id}/submissions/{submission_id}/reply")
async def teacher_reply_submission(assignment_id: str, submission_id: str, data: dict, user: dict = Depends(get_current_user)):
    _require_role(user, ['teacher', 'admin'])
    # Append a reply to the student_submissions doc
    reply = {
        'teacher_id': user.get('user_id'),
        'teacher_name': user.get('name'),
        'message': data.get('message', ''),
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    result = await db.student_submissions.update_one({'submission_id': submission_id, 'assignment_id': assignment_id}, {'$push': {'teacher_replies': reply}})
    if result.matched_count == 0:
        raise HTTPException(404, 'Submission not found')
    # Also update the embedded submission inside assignment document if present
    await db.assignments.update_one({'assignment_id': assignment_id, 'submissions.submission_id': submission_id}, {'$push': {'submissions.$.teacher_replies': reply}})
    return {'success': True, 'reply': reply}


# ==================== CONTENT ROUTES ====================

@api.get("/exams")
async def get_exams():
    exams = await db.exams.find({}, {'_id': 0}).to_list(100)
    return exams

@api.get("/subjects")
async def get_subjects(exam_id: Optional[str] = None):
    query = {'exam_id': exam_id} if exam_id else {}
    subjects = await db.subjects.find(query, {'_id': 0}).to_list(100)
    return subjects

@api.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    subject = await db.subjects.find_one({'subject_id': subject_id}, {'_id': 0})
    if not subject:
        raise HTTPException(404, 'Subject not found')
    return subject

@api.get("/chapters")
async def get_chapters(subject_id: Optional[str] = None):
    query = {'subject_id': subject_id} if subject_id else {}
    chapters = await db.chapters.find(query, {'_id': 0}).sort('order', 1).to_list(100)
    return chapters

@api.get("/chapters/{chapter_id}")
async def get_chapter(chapter_id: str):
    chapter = await db.chapters.find_one({'chapter_id': chapter_id}, {'_id': 0})
    if not chapter:
        raise HTTPException(404, 'Chapter not found')
    return chapter

@api.get("/topics")
async def get_topics(chapter_id: Optional[str] = None):
    query = {'chapter_id': chapter_id} if chapter_id else {}
    topics = await db.topics.find(query, {'_id': 0}).to_list(100)
    return topics

@api.get("/questions")
async def get_questions(
    subject_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    difficulty: Optional[str] = None,
    limit: int = 10
):
    query = {}
    if subject_id: query['subject_id'] = subject_id
    if chapter_id: query['chapter_id'] = chapter_id
    if difficulty: query['difficulty'] = difficulty

    pipeline = [{'$match': query}, {'$sample': {'size': limit}}, {'$project': {'_id': 0}}]
    questions = await db.questions.aggregate(pipeline).to_list(limit)
    return questions

# ==================== PRACTICE ROUTES ====================

@api.post("/practice/submit")
async def submit_practice(data: SubmitAnswerRequest, user: dict = Depends(get_current_user)):
    question = await db.questions.find_one({'question_id': data.question_id}, {'_id': 0})
    if not question:
        raise HTTPException(404, 'Question not found')

    is_correct = data.selected_answer == question['correct_answer']

    attempt = {
        'attempt_id': f"att_{uuid.uuid4().hex[:12]}",
        'user_id': user['user_id'],
        'question_id': data.question_id,
        'subject_id': question.get('subject_id', ''),
        'chapter_id': question.get('chapter_id', ''),
        'selected_answer': data.selected_answer,
        'correct_answer': question['correct_answer'],
        'is_correct': is_correct,
        'time_taken': data.time_taken,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.user_attempts.insert_one(attempt)

    return {
        'is_correct': is_correct,
        'correct_answer': question['correct_answer'],
        'explanation': question.get('explanation', 'No explanation available.')
    }

@api.get("/practice/history")
async def get_practice_history(user: dict = Depends(get_current_user), limit: int = 50):
    attempts = await db.user_attempts.find(
        {'user_id': user['user_id']}, {'_id': 0}
    ).sort('created_at', -1).to_list(limit)
    return attempts

# ==================== AI ROUTES ====================

@api.post("/ai/chat")
async def ai_chat(data: AIChatRequest, user: dict = Depends(get_current_user)):
    session_id = data.session_id or f"chat_{user['user_id']}_{uuid.uuid4().hex[:8]}"

    context_parts = ["You are ExamAce AI Tutor, an expert education assistant for Nepali students."]
    context_parts.append("Help students understand concepts, solve problems, and prepare for exams.")
    context_parts.append("Be encouraging, clear, and provide step-by-step explanations.")
    if data.subject_context:
        context_parts.append(f"Current subject context: {data.subject_context}")
    if data.topic_context:
        context_parts.append(f"Current topic context: {data.topic_context}")
    system_message = " ".join(context_parts)

    # Store user message
    await db.chat_messages.insert_one({
        'message_id': f"msg_{uuid.uuid4().hex[:12]}",
        'user_id': user['user_id'],
        'session_id': session_id,
        'role': 'user',
        'content': data.message,
        'created_at': datetime.now(timezone.utc).isoformat()
    })

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_message
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=data.message))

        # Store AI response
        await db.chat_messages.insert_one({
            'message_id': f"msg_{uuid.uuid4().hex[:12]}",
            'user_id': user['user_id'],
            'session_id': session_id,
            'role': 'assistant',
            'content': response,
            'created_at': datetime.now(timezone.utc).isoformat()
        })

        return {'response': response, 'session_id': session_id}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(500, f'AI service error: {str(e)}')

@api.post("/ai/explain")
async def ai_explain(data: AIExplainRequest, user: dict = Depends(get_current_user)):
    if data.question_id:
        question = await db.questions.find_one({'question_id': data.question_id}, {'_id': 0})
        if question:
            q_text = question['text']
            opts = question.get('options', [])
            correct = question.get('correct_answer', 0)
        else:
            raise HTTPException(404, 'Question not found')
    else:
        q_text = data.question_text or ""
        opts = data.options or []
        correct = data.correct_answer or 0

    prompt = f"""Explain this exam question in detail for a Nepali student:

Question: {q_text}
Options: {', '.join([f'{i+1}. {o}' for i, o in enumerate(opts)])}
Correct Answer: Option {correct + 1} - {opts[correct] if correct < len(opts) else 'N/A'}

Provide:
1. Why the correct answer is right
2. Why other options are wrong
3. Key concept to remember
4. A tip for similar questions"""

    try:
        session_id = f"explain_{user['user_id']}_{uuid.uuid4().hex[:8]}"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are an expert exam tutor for Nepali students. Explain clearly and concisely."
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=prompt))
        return {'explanation': response}
    except Exception as e:
        logger.error(f"AI explain error: {e}")
        raise HTTPException(500, f'AI service error: {str(e)}')

@api.post("/ai/generate-quiz")
async def ai_generate_quiz(data: AIGenerateQuizRequest, user: dict = Depends(get_current_user)):
    prompt = f"""Generate {data.count} multiple choice questions for a Nepali exam student.
Subject: {data.subject}
{f'Topic: {data.topic}' if data.topic else ''}
Difficulty: {data.difficulty}

Return as JSON array with this format:
[{{"text": "question text", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "why"}}]
Only return the JSON array, nothing else."""

    try:
        session_id = f"quiz_{user['user_id']}_{uuid.uuid4().hex[:8]}"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a quiz generator. Always return valid JSON arrays only."
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=prompt))

        import json
        # Try to parse JSON from response
        try:
            # Remove markdown code fences if present
            clean = response.strip()
            if clean.startswith('```'):
                clean = clean.split('\n', 1)[1]
                clean = clean.rsplit('```', 1)[0]
            questions = json.loads(clean)
        except json.JSONDecodeError:
            questions = []

        return {'questions': questions}
    except Exception as e:
        logger.error(f"AI generate quiz error: {e}")
        raise HTTPException(500, f'AI service error: {str(e)}')

@api.get("/ai/chat/history")
async def get_chat_history(session_id: str, user: dict = Depends(get_current_user)):
    messages = await db.chat_messages.find(
        {'session_id': session_id, 'user_id': user['user_id']}, {'_id': 0}
    ).sort('created_at', 1).to_list(200)
    return messages

@api.get("/ai/chat/sessions")
async def get_chat_sessions(user: dict = Depends(get_current_user)):
    pipeline = [
        {'$match': {'user_id': user['user_id']}},
        {'$group': {
            '_id': '$session_id',
            'last_message': {'$last': '$content'},
            'last_time': {'$last': '$created_at'},
            'count': {'$sum': 1}
        }},
        {'$sort': {'last_time': -1}},
        {'$limit': 20},
        {'$project': {
            '_id': 0,
            'session_id': '$_id',
            'last_message': 1,
            'last_time': 1,
            'message_count': '$count'
        }}
    ]
    sessions = await db.chat_messages.aggregate(pipeline).to_list(20)
    return sessions

# ==================== ANALYTICS ROUTES ====================

@api.get("/analytics/dashboard")
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    user_id = user['user_id']

    total_attempts = await db.user_attempts.count_documents({'user_id': user_id})
    correct_attempts = await db.user_attempts.count_documents({'user_id': user_id, 'is_correct': True})
    accuracy = round((correct_attempts / total_attempts * 100) if total_attempts > 0 else 0, 1)

    # Get subjects for user's exam type
    subjects = await db.subjects.find({'exam_id': user.get('exam_type', 'SEE').lower()}, {'_id': 0}).to_list(50)

    # Weekly progress (last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_attempts = await db.user_attempts.find(
        {'user_id': user_id, 'created_at': {'$gte': week_ago}}, {'_id': 0}
    ).to_list(1000)

    daily_stats = {}
    for att in recent_attempts:
        day = att['created_at'][:10]
        if day not in daily_stats:
            daily_stats[day] = {'total': 0, 'correct': 0}
        daily_stats[day]['total'] += 1
        if att['is_correct']:
            daily_stats[day]['correct'] += 1

    # Weak subjects
    weak_pipeline = [
        {'$match': {'user_id': user_id}},
        {'$group': {
            '_id': '$subject_id',
            'total': {'$sum': 1},
            'correct': {'$sum': {'$cond': ['$is_correct', 1, 0]}}
        }},
        {'$project': {
            '_id': 0, 'subject_id': '$_id',
            'total': 1, 'correct': 1,
            'accuracy': {'$cond': [{'$gt': ['$total', 0]}, {'$multiply': [{'$divide': ['$correct', '$total']}, 100]}, 0]}
        }},
        {'$sort': {'accuracy': 1}},
        {'$limit': 5}
    ]
    weak_subjects = await db.user_attempts.aggregate(weak_pipeline).to_list(5)

    return {
        'total_questions_attempted': total_attempts,
        'correct_answers': correct_attempts,
        'accuracy': accuracy,
        'daily_streak': user.get('daily_streak', 0),
        'subjects_count': len(subjects),
        'weekly_stats': daily_stats,
        'weak_subjects': weak_subjects,
        'exam_type': user.get('exam_type', 'SEE')
    }

@api.get("/analytics/subject/{subject_id}")
async def get_subject_analytics(subject_id: str, user: dict = Depends(get_current_user)):
    attempts = await db.user_attempts.find(
        {'user_id': user['user_id'], 'subject_id': subject_id}, {'_id': 0}
    ).to_list(1000)

    total = len(attempts)
    correct = sum(1 for a in attempts if a['is_correct'])
    accuracy = round((correct / total * 100) if total > 0 else 0, 1)

    # Per chapter breakdown
    chapter_stats = {}
    for a in attempts:
        ch = a.get('chapter_id', 'unknown')
        if ch not in chapter_stats:
            chapter_stats[ch] = {'total': 0, 'correct': 0}
        chapter_stats[ch]['total'] += 1
        if a['is_correct']:
            chapter_stats[ch]['correct'] += 1

    return {
        'subject_id': subject_id,
        'total_attempted': total,
        'correct': correct,
        'accuracy': accuracy,
        'chapter_breakdown': chapter_stats
    }

# ==================== SEED DATA ====================

async def seed_data():
    exam_count = await db.exams.count_documents({})
    if exam_count > 0:
        logger.info("Data already seeded, skipping.")
        return

    logger.info("Seeding database with exam data...")

    # Exams
    exams = [
        {'exam_id': 'see', 'name': 'SEE', 'full_name': 'Secondary Education Examination', 'description': 'Grade 10 board examination', 'icon': 'school', 'color': '#38BDF8'},
        {'exam_id': 'neb', 'name': 'NEB +2', 'full_name': 'National Examination Board', 'description': 'Grade 11-12 examination', 'icon': 'library', 'color': '#4ADE80'},
        {'exam_id': 'tu', 'name': 'TU', 'full_name': 'Tribhuvan University', 'description': 'University level examinations', 'icon': 'school', 'color': '#F59E0B'},
        {'exam_id': 'ctevt', 'name': 'CTEVT', 'full_name': 'Council for Technical Education', 'description': 'Technical & vocational exams', 'icon': 'construct', 'color': '#EF4444'},
        {'exam_id': 'loksewa', 'name': 'Loksewa', 'full_name': 'Public Service Commission', 'description': 'Government service examination', 'icon': 'briefcase', 'color': '#8B5CF6'},
    ]
    await db.exams.insert_many(exams)

    # SEE Subjects
    see_subjects = [
        {'subject_id': 'see_math', 'exam_id': 'see', 'name': 'Mathematics', 'description': 'Algebra, Geometry, Trigonometry, Statistics', 'icon': 'calculator', 'color': '#38BDF8', 'chapter_count': 5},
        {'subject_id': 'see_science', 'exam_id': 'see', 'name': 'Science', 'description': 'Physics, Chemistry, Biology, Astronomy', 'icon': 'flask', 'color': '#4ADE80', 'chapter_count': 5},
        {'subject_id': 'see_english', 'exam_id': 'see', 'name': 'English', 'description': 'Grammar, Composition, Literature', 'icon': 'book', 'color': '#F59E0B', 'chapter_count': 4},
        {'subject_id': 'see_social', 'exam_id': 'see', 'name': 'Social Studies', 'description': 'History, Geography, Civics, Economics', 'icon': 'globe', 'color': '#EF4444', 'chapter_count': 4},
        {'subject_id': 'see_nepali', 'exam_id': 'see', 'name': 'Nepali', 'description': 'Grammar, Literature, Composition', 'icon': 'document-text', 'color': '#8B5CF6', 'chapter_count': 3},
    ]

    # NEB +2 Subjects
    neb_subjects = [
        {'subject_id': 'neb_physics', 'exam_id': 'neb', 'name': 'Physics', 'description': 'Mechanics, Optics, Electromagnetism', 'icon': 'magnet', 'color': '#38BDF8', 'chapter_count': 4},
        {'subject_id': 'neb_chemistry', 'exam_id': 'neb', 'name': 'Chemistry', 'description': 'Organic, Inorganic, Physical Chemistry', 'icon': 'flask', 'color': '#4ADE80', 'chapter_count': 4},
        {'subject_id': 'neb_math', 'exam_id': 'neb', 'name': 'Mathematics', 'description': 'Calculus, Algebra, Coordinate Geometry', 'icon': 'calculator', 'color': '#F59E0B', 'chapter_count': 4},
        {'subject_id': 'neb_biology', 'exam_id': 'neb', 'name': 'Biology', 'description': 'Botany, Zoology, Genetics', 'icon': 'leaf', 'color': '#EF4444', 'chapter_count': 3},
    ]

    # Loksewa Subjects
    loksewa_subjects = [
        {'subject_id': 'lok_gk', 'exam_id': 'loksewa', 'name': 'General Knowledge', 'description': 'Nepal GK, World GK, Current Affairs', 'icon': 'globe', 'color': '#38BDF8', 'chapter_count': 3},
        {'subject_id': 'lok_iq', 'exam_id': 'loksewa', 'name': 'IQ & Reasoning', 'description': 'Logical Reasoning, Aptitude, Mental Ability', 'icon': 'bulb', 'color': '#F59E0B', 'chapter_count': 3},
        {'subject_id': 'lok_law', 'exam_id': 'loksewa', 'name': 'Law & Constitution', 'description': 'Nepal Constitution, Civil Law', 'icon': 'document-text', 'color': '#8B5CF6', 'chapter_count': 3},
    ]

    all_subjects = see_subjects + neb_subjects + loksewa_subjects
    await db.subjects.insert_many(all_subjects)

    # Chapters
    chapters_data = {
        'see_math': [
            ('ch_see_math_1', 'Sets', 'Set theory, Venn diagrams, operations', 1),
            ('ch_see_math_2', 'Arithmetic', 'Ratio, proportion, percentage, profit & loss', 2),
            ('ch_see_math_3', 'Algebra', 'Equations, factorization, indices', 3),
            ('ch_see_math_4', 'Geometry', 'Triangles, circles, transformation', 4),
            ('ch_see_math_5', 'Statistics', 'Mean, median, mode, probability', 5),
        ],
        'see_science': [
            ('ch_see_sci_1', 'Force & Motion', 'Newton laws, gravity, friction', 1),
            ('ch_see_sci_2', 'Light & Sound', 'Reflection, refraction, waves', 2),
            ('ch_see_sci_3', 'Chemical Reactions', 'Acids, bases, salts, reactions', 3),
            ('ch_see_sci_4', 'Biology Basics', 'Cell, genetics, ecosystem', 4),
            ('ch_see_sci_5', 'Earth & Space', 'Solar system, climate, geology', 5),
        ],
        'see_english': [
            ('ch_see_eng_1', 'Grammar', 'Tenses, voice, narration, prepositions', 1),
            ('ch_see_eng_2', 'Reading Comprehension', 'Passages, inference, vocabulary', 2),
            ('ch_see_eng_3', 'Writing Skills', 'Essay, letter, report writing', 3),
            ('ch_see_eng_4', 'Literature', 'Stories, poems, drama analysis', 4),
        ],
        'see_social': [
            ('ch_see_soc_1', 'History of Nepal', 'Unification, Rana period, democracy', 1),
            ('ch_see_soc_2', 'Geography', 'Physical, human, economic geography', 2),
            ('ch_see_soc_3', 'Civics', 'Constitution, governance, rights', 3),
            ('ch_see_soc_4', 'Economics', 'Development, trade, planning', 4),
        ],
        'neb_physics': [
            ('ch_neb_phy_1', 'Mechanics', 'Motion, force, energy, momentum', 1),
            ('ch_neb_phy_2', 'Heat & Thermodynamics', 'Temperature, heat transfer, gas laws', 2),
            ('ch_neb_phy_3', 'Optics', 'Lenses, mirrors, wave optics', 3),
            ('ch_neb_phy_4', 'Electromagnetism', 'Current, resistance, magnetism', 4),
        ],
        'lok_gk': [
            ('ch_lok_gk_1', 'Nepal General Knowledge', 'Geography, culture, politics', 1),
            ('ch_lok_gk_2', 'World Affairs', 'International organizations, events', 2),
            ('ch_lok_gk_3', 'Current Affairs', 'Recent events, policies', 3),
        ],
        'lok_iq': [
            ('ch_lok_iq_1', 'Logical Reasoning', 'Patterns, sequences, analogies', 1),
            ('ch_lok_iq_2', 'Numerical Ability', 'Arithmetic, data interpretation', 2),
            ('ch_lok_iq_3', 'Verbal Reasoning', 'Synonyms, antonyms, comprehension', 3),
        ],
    }

    all_chapters = []
    for subject_id, chapters in chapters_data.items():
        for ch_id, name, desc, order in chapters:
            all_chapters.append({
                'chapter_id': ch_id,
                'subject_id': subject_id,
                'name': name,
                'description': desc,
                'order': order,
                'question_count': 5
            })
    await db.chapters.insert_many(all_chapters)

    # Questions - comprehensive set
    questions = []

    # SEE Math - Sets
    math_set_qs = [
        {'question_id': 'q_001', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_1', 'difficulty': 'easy',
         'text': 'If A = {1, 2, 3} and B = {2, 3, 4}, what is A ∪ B?',
         'options': ['{1, 2, 3, 4}', '{2, 3}', '{1, 4}', '{1, 2, 3}'], 'correct_answer': 0,
         'explanation': 'A ∪ B (union) contains all elements from both sets. A ∪ B = {1, 2, 3, 4}'},
        {'question_id': 'q_002', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_1', 'difficulty': 'easy',
         'text': 'If A = {1, 2, 3} and B = {2, 3, 4}, what is A ∩ B?',
         'options': ['{1, 2, 3, 4}', '{2, 3}', '{1, 4}', '{1}'], 'correct_answer': 1,
         'explanation': 'A ∩ B (intersection) contains elements common to both sets. A ∩ B = {2, 3}'},
        {'question_id': 'q_003', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_1', 'difficulty': 'medium',
         'text': 'In a class of 40 students, 25 play football and 20 play cricket. If 10 play both, how many play neither?',
         'options': ['5', '10', '15', '0'], 'correct_answer': 0,
         'explanation': 'Using n(A∪B) = n(A) + n(B) - n(A∩B) = 25 + 20 - 10 = 35. Neither = 40 - 35 = 5'},
        {'question_id': 'q_004', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_1', 'difficulty': 'medium',
         'text': 'Which of the following is an empty set?',
         'options': ['{0}', '{}', '{∅}', 'None'], 'correct_answer': 1,
         'explanation': '{} or ∅ is the empty set. {0} contains element 0, {∅} contains the empty set as element.'},
        {'question_id': 'q_005', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_1', 'difficulty': 'hard',
         'text': 'If n(U) = 50, n(A) = 30, n(B) = 25, n(A∪B) = 40, find n(A∩B).',
         'options': ['10', '15', '20', '5'], 'correct_answer': 1,
         'explanation': 'n(A∩B) = n(A) + n(B) - n(A∪B) = 30 + 25 - 40 = 15'},
    ]

    # SEE Math - Arithmetic
    math_arith_qs = [
        {'question_id': 'q_006', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_2', 'difficulty': 'easy',
         'text': 'If the cost price is Rs. 500 and selling price is Rs. 600, what is the profit percentage?',
         'options': ['10%', '20%', '15%', '25%'], 'correct_answer': 1,
         'explanation': 'Profit = 600-500 = 100. Profit% = (100/500)×100 = 20%'},
        {'question_id': 'q_007', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_2', 'difficulty': 'easy',
         'text': 'The ratio of boys to girls in a class is 3:2. If there are 30 students, how many boys?',
         'options': ['12', '15', '18', '20'], 'correct_answer': 2,
         'explanation': 'Total parts = 3+2 = 5. Boys = (3/5)×30 = 18'},
        {'question_id': 'q_008', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_2', 'difficulty': 'medium',
         'text': 'A sum of Rs. 10,000 at 10% p.a. compound interest for 2 years amounts to?',
         'options': ['Rs. 12,000', 'Rs. 12,100', 'Rs. 11,000', 'Rs. 11,100'], 'correct_answer': 1,
         'explanation': 'A = P(1+r/100)^n = 10000(1.1)^2 = 10000×1.21 = Rs. 12,100'},
        {'question_id': 'q_009', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_2', 'difficulty': 'medium',
         'text': 'If 40% of a number is 80, what is the number?',
         'options': ['160', '200', '320', '120'], 'correct_answer': 1,
         'explanation': '40% × x = 80, x = 80/0.4 = 200'},
        {'question_id': 'q_010', 'subject_id': 'see_math', 'chapter_id': 'ch_see_math_2', 'difficulty': 'hard',
         'text': 'A shopkeeper marks the price 25% above CP and gives 10% discount. Find his profit%.',
         'options': ['12.5%', '15%', '10%', '13.5%'], 'correct_answer': 0,
         'explanation': 'Let CP=100, MP=125, SP=125×0.9=112.5. Profit% = 12.5%'},
    ]

    # SEE Science
    science_qs = [
        {'question_id': 'q_011', 'subject_id': 'see_science', 'chapter_id': 'ch_see_sci_1', 'difficulty': 'easy',
         'text': 'What is the SI unit of force?',
         'options': ['Joule', 'Newton', 'Watt', 'Pascal'], 'correct_answer': 1,
         'explanation': 'The SI unit of force is Newton (N), named after Sir Isaac Newton.'},
        {'question_id': 'q_012', 'subject_id': 'see_science', 'chapter_id': 'ch_see_sci_1', 'difficulty': 'easy',
         'text': 'According to Newton\'s first law, an object at rest tends to:',
         'options': ['Move slowly', 'Stay at rest', 'Accelerate', 'Decelerate'], 'correct_answer': 1,
         'explanation': 'Newton\'s first law (law of inertia) states that an object at rest stays at rest unless acted upon by an external force.'},
        {'question_id': 'q_013', 'subject_id': 'see_science', 'chapter_id': 'ch_see_sci_2', 'difficulty': 'medium',
         'text': 'The speed of light in vacuum is approximately:',
         'options': ['3×10⁶ m/s', '3×10⁸ m/s', '3×10¹⁰ m/s', '3×10⁴ m/s'], 'correct_answer': 1,
         'explanation': 'The speed of light in vacuum is approximately 3×10⁸ meters per second (300,000 km/s).'},
        {'question_id': 'q_014', 'subject_id': 'see_science', 'chapter_id': 'ch_see_sci_3', 'difficulty': 'easy',
         'text': 'What is the pH value of pure water?',
         'options': ['0', '7', '14', '1'], 'correct_answer': 1,
         'explanation': 'Pure water is neutral with a pH of 7. Below 7 is acidic, above 7 is basic.'},
        {'question_id': 'q_015', 'subject_id': 'see_science', 'chapter_id': 'ch_see_sci_4', 'difficulty': 'easy',
         'text': 'The powerhouse of the cell is:',
         'options': ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], 'correct_answer': 2,
         'explanation': 'Mitochondria are called the powerhouse of the cell as they produce ATP through cellular respiration.'},
    ]

    # Loksewa GK
    loksewa_qs = [
        {'question_id': 'q_016', 'subject_id': 'lok_gk', 'chapter_id': 'ch_lok_gk_1', 'difficulty': 'easy',
         'text': 'What is the capital of Nepal?',
         'options': ['Pokhara', 'Kathmandu', 'Biratnagar', 'Lalitpur'], 'correct_answer': 1,
         'explanation': 'Kathmandu is the capital and largest city of Nepal.'},
        {'question_id': 'q_017', 'subject_id': 'lok_gk', 'chapter_id': 'ch_lok_gk_1', 'difficulty': 'medium',
         'text': 'How many provinces are there in Nepal?',
         'options': ['5', '6', '7', '8'], 'correct_answer': 2,
         'explanation': 'Nepal has 7 provinces as per the 2015 constitution.'},
        {'question_id': 'q_018', 'subject_id': 'lok_gk', 'chapter_id': 'ch_lok_gk_1', 'difficulty': 'medium',
         'text': 'Mount Everest is located in which district of Nepal?',
         'options': ['Solukhumbu', 'Kathmandu', 'Mustang', 'Manang'], 'correct_answer': 0,
         'explanation': 'Mount Everest (Sagarmatha) is located in Solukhumbu district.'},
        {'question_id': 'q_019', 'subject_id': 'lok_iq', 'chapter_id': 'ch_lok_iq_1', 'difficulty': 'easy',
         'text': 'What comes next: 2, 6, 12, 20, ?',
         'options': ['28', '30', '32', '26'], 'correct_answer': 1,
         'explanation': 'Pattern: differences are 4, 6, 8, 10. Next: 20 + 10 = 30'},
        {'question_id': 'q_020', 'subject_id': 'lok_iq', 'chapter_id': 'ch_lok_iq_2', 'difficulty': 'medium',
         'text': 'If 5 workers can build a wall in 10 days, how many days will 10 workers take?',
         'options': ['5 days', '20 days', '15 days', '8 days'], 'correct_answer': 0,
         'explanation': 'Work = 5×10 = 50 man-days. With 10 workers: 50/10 = 5 days'},
    ]

    # NEB Physics
    neb_qs = [
        {'question_id': 'q_021', 'subject_id': 'neb_physics', 'chapter_id': 'ch_neb_phy_1', 'difficulty': 'medium',
         'text': 'A body of mass 2 kg is moving with velocity 3 m/s. What is its kinetic energy?',
         'options': ['6 J', '9 J', '12 J', '3 J'], 'correct_answer': 1,
         'explanation': 'KE = ½mv² = ½×2×3² = ½×2×9 = 9 J'},
        {'question_id': 'q_022', 'subject_id': 'neb_physics', 'chapter_id': 'ch_neb_phy_2', 'difficulty': 'easy',
         'text': 'Heat always flows from:',
         'options': ['Cold to hot body', 'Hot to cold body', 'Both directions equally', 'None of the above'], 'correct_answer': 1,
         'explanation': 'According to the second law of thermodynamics, heat flows spontaneously from hot to cold body.'},
        {'question_id': 'q_023', 'subject_id': 'neb_physics', 'chapter_id': 'ch_neb_phy_3', 'difficulty': 'medium',
         'text': 'The focal length of a concave mirror is 10 cm. What is its radius of curvature?',
         'options': ['5 cm', '10 cm', '20 cm', '15 cm'], 'correct_answer': 2,
         'explanation': 'R = 2f = 2×10 = 20 cm. The radius of curvature is twice the focal length.'},
        {'question_id': 'q_024', 'subject_id': 'neb_physics', 'chapter_id': 'ch_neb_phy_4', 'difficulty': 'easy',
         'text': 'The unit of electric current is:',
         'options': ['Volt', 'Ohm', 'Ampere', 'Watt'], 'correct_answer': 2,
         'explanation': 'Electric current is measured in Ampere (A), named after André-Marie Ampère.'},
        {'question_id': 'q_025', 'subject_id': 'neb_physics', 'chapter_id': 'ch_neb_phy_1', 'difficulty': 'hard',
         'text': 'A projectile is thrown at 60° with horizontal at 20 m/s. What is the maximum height? (g=10m/s²)',
         'options': ['10 m', '15 m', '20 m', '5 m'], 'correct_answer': 1,
         'explanation': 'H = u²sin²θ/2g = (20²×sin²60°)/(2×10) = (400×0.75)/20 = 15 m'},
    ]

    # SEE English
    english_qs = [
        {'question_id': 'q_026', 'subject_id': 'see_english', 'chapter_id': 'ch_see_eng_1', 'difficulty': 'easy',
         'text': 'Choose the correct form: She ___ to school every day.',
         'options': ['go', 'goes', 'going', 'gone'], 'correct_answer': 1,
         'explanation': 'With third person singular (she/he/it), we use "goes" in simple present tense.'},
        {'question_id': 'q_027', 'subject_id': 'see_english', 'chapter_id': 'ch_see_eng_1', 'difficulty': 'medium',
         'text': 'Change to passive: "Ram writes a letter."',
         'options': ['A letter is written by Ram.', 'A letter was written by Ram.', 'A letter is being written by Ram.', 'A letter has been written by Ram.'], 'correct_answer': 0,
         'explanation': 'Simple present active → Simple present passive: Subject + is/am/are + V3 + by + agent.'},
        {'question_id': 'q_028', 'subject_id': 'see_english', 'chapter_id': 'ch_see_eng_1', 'difficulty': 'easy',
         'text': 'What is the synonym of "beautiful"?',
         'options': ['Ugly', 'Pretty', 'Bad', 'Harsh'], 'correct_answer': 1,
         'explanation': '"Pretty" is a synonym of "beautiful", meaning pleasant to look at.'},
    ]

    # SEE Social Studies
    social_qs = [
        {'question_id': 'q_029', 'subject_id': 'see_social', 'chapter_id': 'ch_see_soc_1', 'difficulty': 'easy',
         'text': 'Who unified Nepal?',
         'options': ['Prithvi Narayan Shah', 'Jung Bahadur Rana', 'Tribhuvan', 'Mahendra'], 'correct_answer': 0,
         'explanation': 'King Prithvi Narayan Shah of Gorkha unified various kingdoms into modern Nepal.'},
        {'question_id': 'q_030', 'subject_id': 'see_social', 'chapter_id': 'ch_see_soc_3', 'difficulty': 'medium',
         'text': 'When was the current constitution of Nepal promulgated?',
         'options': ['2015 BS', '2072 BS', '2063 BS', '2070 BS'], 'correct_answer': 1,
         'explanation': 'The Constitution of Nepal was promulgated on Asoj 3, 2072 BS (September 20, 2015 AD).'},
    ]

    all_questions = (math_set_qs + math_arith_qs + science_qs + loksewa_qs +
                     neb_qs + english_qs + social_qs)
    await db.questions.insert_many(all_questions)

    # Seed Past Question Papers
    past_papers = [
        {'paper_id': 'pp_001', 'node_id': 'subject-c-programming', 'title': 'BIT 3rd Semester DBMS 2080', 'year': 2080, 'semester': 3, 'exam_type': 'regular', 'pdf_url': 'https://example.com/bit3-dbms-2080.pdf', 'pdf_file_size': 2048000, 'downloadable': True, 'preview_in_app': True, 'question_count': 8, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'paper_id': 'pp_002', 'node_id': 'subject-c-programming', 'title': 'BIT 3rd Semester DBMS 2079 (Back)', 'year': 2079, 'semester': 3, 'exam_type': 'back', 'pdf_url': 'https://example.com/bit3-dbms-2079-back.pdf', 'pdf_file_size': 1800000, 'downloadable': True, 'preview_in_app': True, 'question_count': 6, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'paper_id': 'pp_003', 'node_id': 'subject-mathematics', 'title': 'SEE Mathematics 2080', 'year': 2080, 'semester': None, 'exam_type': 'regular', 'pdf_url': 'https://example.com/see-math-2080.pdf', 'pdf_file_size': 1500000, 'downloadable': True, 'preview_in_app': True, 'question_count': 10, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'paper_id': 'pp_004', 'node_id': 'subject-physics', 'title': 'NEB Physics 2080', 'year': 2080, 'semester': None, 'exam_type': 'regular', 'pdf_url': 'https://example.com/neb-physics-2080.pdf', 'pdf_file_size': 2200000, 'downloadable': True, 'preview_in_app': True, 'question_count': 12, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.past_papers.insert_many(past_papers)

    # Seed Study Notes
    study_notes = [
        {'note_id': 'note_001', 'node_id': 'subject-c-programming', 'chapter_id': None, 'title': 'C Programming Fundamentals', 'content': '# C Programming\n\n## Introduction\nC is a procedural language...\n\n## Variables\nVariables are named storage locations...', 'author': 'Prof. Ram Sharma', 'author_email': 'ram@example.com', 'tags': ['basics', 'syntax'], 'downloadable_pdf': True, 'pdf_url': 'https://example.com/c-basics.pdf', 'markdown': True, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'note_id': 'note_002', 'node_id': 'subject-mathematics', 'chapter_id': None, 'title': 'Algebra Quick Reference', 'content': '# Algebraic Formulas\n\n- (a+b)² = a² + 2ab + b²\n- (a-b)² = a² - 2ab + b²', 'author': 'Prof. Sita Devi', 'author_email': 'sita@example.com', 'tags': ['algebra', 'formulas'], 'downloadable_pdf': True, 'pdf_url': 'https://example.com/algebra-formulas.pdf', 'markdown': True, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.study_notes.insert_many(study_notes)

    # Seed Video Solutions
    videos = [
        {'video_id': 'vid_001', 'node_id': 'subject-c-programming', 'chapter_id': None, 'question_id': None, 'title': 'C Loops Tutorial', 'description': 'Complete guide to loops in C programming', 'video_url': 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'video_type': 'youtube', 'duration_seconds': 1200, 'thumbnail_url': 'https://example.com/thumb1.jpg', 'chapter_mapping': {'chapter': 'loops', 'topics': ['for', 'while', 'do-while']}, 'timestamp_chapters': [{'time': 0, 'chapter': 'Introduction'}, {'time': 120, 'chapter': 'For Loops'}, {'time': 400, 'chapter': 'While Loops'}], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'video_id': 'vid_002', 'node_id': 'subject-physics', 'chapter_id': None, 'question_id': 'q_026', 'title': 'Kinematics Problem Solving', 'description': 'Step-by-step solution to kinematics problems', 'video_url': 'https://www.youtube.com/embed/abcdEFG', 'video_type': 'youtube', 'duration_seconds': 900, 'thumbnail_url': 'https://example.com/thumb2.jpg', 'chapter_mapping': {'chapter': 'kinematics', 'topics': ['displacement', 'velocity', 'acceleration']}, 'timestamp_chapters': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.video_solutions.insert_many(videos)

    # Seed Important Questions
    important_qs = [
        {'importance_id': 'imp_001', 'question_id': 'q_001', 'node_id': 'subject-mathematics', 'importance_tags': ['very_important', 'repeated_in_exam'], 'reason': 'Set theory is foundational and appears in every exam', 'frequency_in_exams': 5, 'last_appeared_year': 2080, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'importance_id': 'imp_002', 'question_id': 'q_011', 'node_id': 'subject-physics', 'importance_tags': ['likely_exam_question'], 'reason': 'Basic physics concepts always asked', 'frequency_in_exams': 6, 'last_appeared_year': 2080, 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.important_questions.insert_many(important_qs)

    # Seed Assignments
    assignments = [
        {'assignment_id': 'assign_001', 'node_id': 'subject-c-programming', 'chapter_id': None, 'title': 'Calculate Sum of Digits', 'description': 'Write a C program to calculate the sum of digits of a number', 'instructions': '1. Write a C function that takes an integer\n2. Calculate sum of its digits\n3. Return the result', 'posted_by_teacher': 'prof.ram@school.com', 'posted_by_name': 'Prof. Ram', 'due_date': '2081-06-15T23:59:59', 'file_url': 'https://example.com/assignment1.pdf', 'total_points': 10.0, 'status': 'published', 'submissions': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
        {'assignment_id': 'assign_002', 'node_id': 'subject-mathematics', 'chapter_id': None, 'title': 'Solve Quadratic Equations', 'description': 'Solve 5 quadratic equations using different methods', 'instructions': '1. Solve using factorization\n2. Solve using quadratic formula\n3. Show all steps clearly', 'posted_by_teacher': 'prof.sita@school.com', 'posted_by_name': 'Prof. Sita', 'due_date': '2081-06-20T23:59:59', 'file_url': None, 'total_points': 15.0, 'status': 'published', 'submissions': [], 'created_at': datetime.now(timezone.utc).isoformat(), 'updated_at': datetime.now(timezone.utc).isoformat()},
    ]
    await db.assignments.insert_many(assignments)

    # Seed indexes for new collections
    await db.past_papers.create_index('node_id')
    await db.past_papers.create_index('year')
    await db.study_notes.create_index('node_id')
    await db.study_notes.create_index('chapter_id')
    await db.video_solutions.create_index('node_id')
    await db.important_questions.create_index('question_id')
    await db.important_questions.create_index('node_id')
    await db.assignments.create_index('node_id')
    await db.assignments.create_index('posted_by_teacher')
    await db.student_submissions.create_index('assignment_id')
    await db.student_submissions.create_index('student_id')

    # Create indexes
    await db.users.create_index('email', unique=True)
    await db.users.create_index('user_id', unique=True)
    await db.subjects.create_index('exam_id')
    await db.chapters.create_index('subject_id')
    await db.questions.create_index([('subject_id', 1), ('chapter_id', 1), ('difficulty', 1)])
    await db.user_attempts.create_index([('user_id', 1), ('created_at', -1)])
    await db.chat_messages.create_index([('session_id', 1), ('created_at', 1)])
    await db.users.create_index('referral_code', unique=True, sparse=True)

    logger.info(f"Seeded: {len(exams)} exams, {len(all_subjects)} subjects, {len(all_chapters)} chapters, {len(all_questions)} questions")
    logger.info(f"Seeded: {len(past_papers)} past papers, {len(study_notes)} notes, {len(videos)} videos, {len(important_qs)} important Qs, {len(assignments)} assignments")

async def migrate_existing_users():
    """Add referral_code to users that don't have one."""
    users_without_code = await db.users.find(
        {'referral_code': {'$exists': False}}, {'_id': 0, 'user_id': 1}
    ).to_list(10000)
    for u in users_without_code:
        code = generate_referral_code()
        while await db.users.find_one({'referral_code': code}, {'_id': 0}):
            code = generate_referral_code()
        await db.users.update_one(
            {'user_id': u['user_id']},
            {'$set': {'referral_code': code, 'referral_count': 0, 'referred_by': None, 'premium_expires': None}}
        )
    if users_without_code:
        logger.info(f"Migrated {len(users_without_code)} users with referral codes")

# ==================== STARTUP & MIDDLEWARE ====================

@app.on_event("startup")
async def startup():
    await seed_data()
    await migrate_existing_users()

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
