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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Config
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'examace-fallback-secret')
JWT_ALGORITHM = 'HS256'
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

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
        'cached_at': datetime.now(timezone.utc).isoformat(),
    }

# Google OAuth
@api.post("/auth/google/init")
async def google_init():
    state = uuid.uuid4().hex
    await db.google_auth_states.insert_one({
        'state': state,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat()
    })
    return {'state': state}

@api.get("/auth/google/callback", response_class=HTMLResponse)
async def google_callback(state: str = ""):
    html = f"""<!DOCTYPE html><html><body>
    <p>Processing authentication...</p>
    <script>
    (async()=>{{
        const hash=window.location.hash;
        const match=hash.match(/session_id=([^&]+)/);
        if(match){{
            const sid=match[1];
            await fetch('/api/auth/google/complete',{{
                method:'POST',headers:{{'Content-Type':'application/json'}},
                body:JSON.stringify({{state:'{state}',session_id:sid}})
            }});
            window.close();
            document.body.innerHTML='<h2>Authentication successful! You can close this window.</h2>';
        }}else{{
            document.body.innerHTML='<h2>Authentication failed.</h2>';
        }}
    }})();
    </script></body></html>"""
    return HTMLResponse(html)

@api.post("/auth/google/complete")
async def google_complete(data: dict):
    state = data.get('state', '')
    session_id = data.get('session_id', '')

    auth_state = await db.google_auth_states.find_one({'state': state}, {'_id': 0})
    if not auth_state:
        raise HTTPException(400, 'Invalid state')

    try:
        async with httpx.AsyncClient() as hc:
            resp = await hc.get(
                'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
                headers={'X-Session-ID': session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(400, 'Failed to verify session')
            google_user = resp.json()
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(400, 'Authentication failed')

    existing = await db.users.find_one({'email': google_user['email']}, {'_id': 0})
    if existing:
        user_id = existing['user_id']
        await db.users.update_one(
            {'user_id': user_id},
            {'$set': {'name': google_user['name'], 'picture': google_user.get('picture', '')}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            'user_id': user_id,
            'name': google_user['name'],
            'email': google_user['email'],
            'picture': google_user.get('picture', ''),
            'exam_type': 'SEE',
            'subscription_status': 'free',
            'daily_streak': 1,
            'last_active': datetime.now(timezone.utc).isoformat(),
            'created_at': datetime.now(timezone.utc).isoformat()
        })

    await update_streak(user_id)
    token = create_token(user_id)
    user = await db.users.find_one({'user_id': user_id}, {'_id': 0})

    await db.google_auth_states.update_one(
        {'state': state},
        {'$set': {'status': 'completed', 'token': token, 'user': {
            'user_id': user['user_id'], 'name': user['name'], 'email': user['email'],
            'exam_type': user.get('exam_type', 'SEE'),
            'subscription_status': user.get('subscription_status', 'free'),
            'daily_streak': user.get('daily_streak', 0)
        }}}
    )
    return {'success': True}

@api.get("/auth/google/status")
async def google_status(state: str):
    auth_state = await db.google_auth_states.find_one({'state': state}, {'_id': 0})
    if not auth_state:
        raise HTTPException(404, 'State not found')
    if auth_state['status'] == 'completed':
        return {'status': 'completed', 'token': auth_state['token'], 'user': auth_state['user']}
    return {'status': 'pending'}

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
