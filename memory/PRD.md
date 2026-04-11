# ExamAce Nepal - PRD

## Overview
AI-powered exam preparation platform for Nepali students (TU, CTEVT, Loksewa, SEE, +2).

## Tech Stack
- **Frontend:** React Native (Expo) with TypeScript, Zustand state management
- **Backend:** FastAPI with MongoDB (Motor async driver)
- **AI:** OpenAI GPT-5.2 via Emergent LLM Key
- **Auth:** JWT email/password + Emergent Google OAuth

## Features Implemented
1. **Authentication** - Email/password registration & login, Google OAuth, JWT tokens
2. **Dashboard** - Welcome greeting, daily streak, stats (questions/accuracy/streak), quick actions, subject cards
3. **Subjects Browser** - Exam type filter (SEE, NEB+2, TU, CTEVT, Loksewa), subject cards with chapter counts
4. **Subject Detail** - Chapter list with Study/Practice buttons
5. **Chapter Detail** - Study mode (Q&A with expandable answers), practice button
6. **Practice System** - Subject/difficulty/count selection, MCQ quiz with 30s timer, instant feedback, AI explanations
7. **AI Tutor Chat** - GPT-5.2 powered chat, quick prompts, session management
8. **Profile** - User info, stats, premium upgrade (MOCKED), logout
9. **Analytics** - Dashboard stats, accuracy tracking, streak management

## Database Collections
- users, exams, subjects, chapters, questions, user_attempts, chat_messages, google_auth_states

## Seed Data
- 5 exam types, 12 subjects, 28 chapters, 30 questions

## API Endpoints
- /api/auth/* (register, login, me, google/*)
- /api/exams, /api/subjects, /api/chapters, /api/topics, /api/questions
- /api/practice/submit, /api/practice/history
- /api/ai/chat, /api/ai/explain, /api/ai/generate-quiz
- /api/analytics/dashboard, /api/analytics/subject/{id}

## Payment
- MOCKED - eSewa/Khalti integration placeholder
