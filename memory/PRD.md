# ExamAce Nepal - Product Requirements Document

## Overview
AI-powered exam preparation platform for Nepali students (TU, CTEVT, Loksewa, SEE, +2).

## Tech Stack
- **Frontend:** React Native (Expo SDK 54) with TypeScript, Zustand state management, expo-router
- **Backend:** FastAPI with MongoDB (Motor async driver)
- **AI:** OpenAI GPT-5.2 via Emergent LLM Key (emergentintegrations library)
- **Auth:** JWT email/password + Emergent-managed Google OAuth

## Features Implemented (MVP)
1. **Authentication** - Email/password registration & login, Google OAuth flow, JWT tokens, visual error feedback
2. **Dashboard** - Welcome greeting, daily streak badge, stats (questions/accuracy/streak), quick action cards, subject list for user's exam type, offline-aware data loading
3. **Subjects Browser** - Exam type filter (SEE, NEB+2, TU, CTEVT, Loksewa), subject cards with chapter counts, offline badge indicator, cached data fallback
4. **Subject Detail** - Chapter list with Study/Practice buttons per chapter
5. **Chapter Detail** - Study mode (Q&A with expandable answers & explanations), chapter practice launch
6. **Practice System** - Subject/difficulty/count selection, MCQ quiz with 30s timer, instant feedback (correct/incorrect), stored explanations + AI explanations, progress tracking
7. **AI Tutor Chat** - GPT-5.2 powered conversational tutor, quick prompts, session management, new chat creation
8. **Profile** - User info, avatar, stats grid, referral section, offline cache management, premium upgrade, about, logout
9. **Analytics** - Dashboard stats, accuracy tracking, streak management, weak subject detection
10. **Auth Persistence** - Token stored in AsyncStorage, auto-redirect on app open
11. **Referral System** - Unique 6-char codes, share button, apply code on signup or profile, both users get 1 week premium, referral count tracking
12. **Offline Caching** - Network-first with stale cache fallback (fetchWithCache utility), cache size tracking, clear cache from profile, 24h TTL, bulk content download endpoint

## Database Collections
- `users` - User accounts with exam_type, streak, subscription
- `exams` - SEE, NEB +2, TU, CTEVT, Loksewa
- `subjects` - Per exam, with icons and colors
- `chapters` - Per subject, ordered
- `questions` - MCQs with options, correct answer, explanation, difficulty
- `user_attempts` - Practice history per user
- `chat_messages` - AI chat history per session
- `google_auth_states` - OAuth state tracking

## Seed Data
- 5 exam types, 12 subjects, 28 chapters, 30 MCQ questions (SEE Math, Science, English, Social; NEB Physics; Loksewa GK/IQ)

## API Endpoints (all prefixed with /api)
### Auth
- POST /auth/register - Create account
- POST /auth/login - Login
- GET /auth/me - Current user
- POST /auth/google/init - Start Google OAuth
- GET /auth/google/callback - OAuth callback HTML
- POST /auth/google/complete - Exchange session_id
- GET /auth/google/status - Poll OAuth result

### Content
- GET /exams - All exams
- GET /subjects?exam_id= - Subjects by exam
- GET /subjects/{id} - Single subject
- GET /chapters?subject_id= - Chapters by subject
- GET /chapters/{id} - Single chapter
- GET /questions?subject_id=&chapter_id=&difficulty=&limit= - Random questions

### Practice
- POST /practice/submit - Submit answer
- GET /practice/history - User's attempt history

### AI (GPT-5.2)
- POST /ai/chat - Chat with AI tutor
- POST /ai/explain - Get AI explanation for a question
- POST /ai/generate-quiz - Generate quiz questions
- GET /ai/chat/history - Chat history
- GET /ai/chat/sessions - User's chat sessions

### Analytics
- GET /analytics/dashboard - User dashboard stats
- GET /analytics/subject/{id} - Subject-level analytics

## MOCKED Features
- **Payment** - eSewa/Khalti integration placeholder
- **Offline Mode** - Not implemented yet
- **Mock Exams** - Full-length timed exams (can be added)
- **Leaderboard** - Not implemented yet
- **Admin Panel** - Not implemented yet

## Enhancement Opportunity
- **Referral system** for viral growth (each referral gives 1 week premium)
- **Daily quiz notifications** to boost retention
- **PDF notes** integration for offline study material
