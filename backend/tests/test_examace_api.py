"""
ExamAce Nepal - Backend API Tests
Tests: Auth (register, login, JWT), Content (exams, subjects, chapters, questions), Practice, Analytics, Referral, Cache
"""
import pytest
import requests
import os
import time

# Read from frontend .env or use public URL
def get_base_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return 'https://ace-tutor-nepal.preview.emergentagent.com'

BASE_URL = get_base_url()

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def test_user_token(api_client):
    """Create test user and return auth token"""
    # Register new test user
    register_payload = {
        "name": "TEST_User",
        "email": f"test_{os.urandom(4).hex()}@examace.com",
        "password": "Test123456",
        "exam_type": "SEE"
    }
    
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=register_payload)
    if response.status_code == 201 or response.status_code == 200:
        data = response.json()
        return data['token']
    
    # If registration fails, try login with existing test credentials
    login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@examace.com",
        "password": "Test123456"
    })
    if login_response.status_code == 200:
        return login_response.json()['token']
    
    pytest.skip("Could not create or login test user")

# ==================== HEALTH & CONTENT TESTS ====================

class TestHealth:
    """Basic health and content availability tests"""
    
    def test_exams_endpoint(self, api_client):
        """GET /api/exams returns exam data"""
        response = api_client.get(f"{BASE_URL}/api/exams")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one exam"
        
        # Verify exam structure
        exam = data[0]
        assert 'exam_id' in exam
        assert 'name' in exam
        assert 'full_name' in exam
        print(f"✓ Exams endpoint working - {len(data)} exams found")

    def test_subjects_endpoint(self, api_client):
        """GET /api/subjects returns subject data"""
        response = api_client.get(f"{BASE_URL}/api/subjects")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have subjects"
        print(f"✓ Subjects endpoint working - {len(data)} subjects found")

    def test_subjects_filter_by_exam(self, api_client):
        """GET /api/subjects?exam_id=see filters correctly"""
        response = api_client.get(f"{BASE_URL}/api/subjects?exam_id=see")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All subjects should be for SEE exam
        for subject in data:
            assert subject['exam_id'] == 'see'
        print(f"✓ Subject filtering working - {len(data)} SEE subjects")

    def test_chapters_endpoint(self, api_client):
        """GET /api/chapters?subject_id=see_math returns chapters"""
        response = api_client.get(f"{BASE_URL}/api/chapters?subject_id=see_math")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have chapters for see_math"
        
        # Verify chapter structure
        chapter = data[0]
        assert 'chapter_id' in chapter
        assert 'subject_id' in chapter
        assert chapter['subject_id'] == 'see_math'
        print(f"✓ Chapters endpoint working - {len(data)} chapters for see_math")

    def test_questions_endpoint(self, api_client):
        """GET /api/questions?subject_id=see_math&difficulty=easy&limit=5"""
        response = api_client.get(f"{BASE_URL}/api/questions?subject_id=see_math&difficulty=easy&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have questions"
        assert len(data) <= 5, "Should respect limit"
        
        # Verify question structure
        question = data[0]
        assert 'question_id' in question
        assert 'text' in question
        assert 'options' in question
        assert 'correct_answer' in question
        assert 'difficulty' in question
        print(f"✓ Questions endpoint working - {len(data)} questions returned")

# ==================== AUTH TESTS ====================

class TestAuth:
    """Authentication flow tests"""
    
    def test_register_new_user(self, api_client):
        """POST /api/auth/register creates new user"""
        unique_email = f"newuser_{os.urandom(4).hex()}@examace.com"
        payload = {
            "name": "New Test User",
            "email": unique_email,
            "password": "NewUser123",
            "exam_type": "NEB +2"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        
        data = response.json()
        assert 'token' in data, "Response should contain token"
        assert 'user' in data, "Response should contain user"
        
        user = data['user']
        assert user['email'] == unique_email
        assert user['name'] == payload['name']
        assert user['exam_type'] == payload['exam_type']
        assert user['daily_streak'] >= 1
        print(f"✓ User registration successful - {user['email']}")

    def test_register_duplicate_email(self, api_client):
        """POST /api/auth/register with existing email fails"""
        # First registration
        email = f"duplicate_{os.urandom(4).hex()}@examace.com"
        payload = {
            "name": "Duplicate User",
            "email": email,
            "password": "Test123",
            "exam_type": "SEE"
        }
        
        response1 = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response1.status_code in [200, 201]
        
        # Second registration with same email
        response2 = api_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response2.status_code == 400, "Should reject duplicate email"
        print("✓ Duplicate email rejection working")

    def test_login_success(self, api_client, test_user_token):
        """POST /api/auth/login with valid credentials"""
        # We already have a test user from fixture, try logging in with test credentials
        payload = {
            "email": "test@examace.com",
            "password": "Test123456"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        # If user doesn't exist, create it first
        if response.status_code == 401:
            api_client.post(f"{BASE_URL}/api/auth/register", json={
                "name": "Test Student",
                "email": "test@examace.com",
                "password": "Test123456",
                "exam_type": "SEE"
            })
            response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'token' in data
        assert 'user' in data
        print(f"✓ Login successful - {data['user']['email']}")

    def test_login_invalid_credentials(self, api_client):
        """POST /api/auth/login with wrong password fails"""
        payload = {
            "email": "test@examace.com",
            "password": "WrongPassword123"
        }
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401, "Should reject invalid credentials"
        print("✓ Invalid credentials rejection working")

    def test_auth_me_with_token(self, api_client, test_user_token):
        """GET /api/auth/me with valid JWT token"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'user_id' in data
        assert 'email' in data
        assert 'name' in data
        assert 'exam_type' in data
        print(f"✓ Auth /me endpoint working - {data['email']}")

    def test_auth_me_without_token(self, api_client):
        """GET /api/auth/me without token fails"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, "Should require authentication"
        print("✓ Auth protection working")

# ==================== PRACTICE TESTS ====================

class TestPractice:
    """Practice submission and history tests"""
    
    def test_submit_answer_correct(self, api_client, test_user_token):
        """POST /api/practice/submit with correct answer"""
        # First get a question
        questions_response = api_client.get(f"{BASE_URL}/api/questions?subject_id=see_math&limit=1")
        assert questions_response.status_code == 200
        questions = questions_response.json()
        
        if len(questions) == 0:
            pytest.skip("No questions available for testing")
        
        question = questions[0]
        
        # Submit correct answer
        headers = {"Authorization": f"Bearer {test_user_token}"}
        payload = {
            "question_id": question['question_id'],
            "selected_answer": question['correct_answer'],
            "time_taken": 15
        }
        
        response = api_client.post(f"{BASE_URL}/api/practice/submit", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'is_correct' in data
        assert data['is_correct'] == True, "Should mark correct answer as correct"
        assert 'correct_answer' in data
        assert 'explanation' in data
        print(f"✓ Practice submit working - correct answer recorded")

    def test_submit_answer_incorrect(self, api_client, test_user_token):
        """POST /api/practice/submit with wrong answer"""
        # Get a question
        questions_response = api_client.get(f"{BASE_URL}/api/questions?subject_id=see_science&limit=1")
        assert questions_response.status_code == 200
        questions = questions_response.json()
        
        if len(questions) == 0:
            pytest.skip("No questions available")
        
        question = questions[0]
        
        # Submit wrong answer (pick different from correct)
        wrong_answer = (question['correct_answer'] + 1) % len(question['options'])
        
        headers = {"Authorization": f"Bearer {test_user_token}"}
        payload = {
            "question_id": question['question_id'],
            "selected_answer": wrong_answer,
            "time_taken": 20
        }
        
        response = api_client.post(f"{BASE_URL}/api/practice/submit", json=payload, headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data['is_correct'] == False, "Should mark wrong answer as incorrect"
        print(f"✓ Practice submit working - incorrect answer recorded")

    def test_practice_history(self, api_client, test_user_token):
        """GET /api/practice/history returns user attempts"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/practice/history", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # Should have attempts from previous tests
        print(f"✓ Practice history working - {len(data)} attempts found")

# ==================== ANALYTICS TESTS ====================

class TestAnalytics:
    """Dashboard and analytics tests"""
    
    def test_dashboard_analytics(self, api_client, test_user_token):
        """GET /api/analytics/dashboard returns user stats"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/analytics/dashboard", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'total_questions_attempted' in data
        assert 'correct_answers' in data
        assert 'accuracy' in data
        assert 'daily_streak' in data
        assert 'subjects_count' in data
        assert 'exam_type' in data
        
        # Verify data types
        assert isinstance(data['total_questions_attempted'], int)
        assert isinstance(data['accuracy'], (int, float))
        assert isinstance(data['daily_streak'], int)
        print(f"✓ Dashboard analytics working - {data['total_questions_attempted']} attempts, {data['accuracy']}% accuracy")

    def test_subject_analytics(self, api_client, test_user_token):
        """GET /api/analytics/subject/{subject_id} returns subject stats"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/analytics/subject/see_math", headers=headers)
        
        assert response.status_code == 200
        
        data = response.json()
        assert 'subject_id' in data
        assert 'total_attempted' in data
        assert 'correct' in data
        assert 'accuracy' in data
        assert data['subject_id'] == 'see_math'
        print(f"✓ Subject analytics working - {data['total_attempted']} attempts for see_math")

# ==================== AI TESTS (Basic) ====================

class TestAI:
    """AI endpoints basic tests (not testing actual AI responses)"""
    
    def test_ai_chat_endpoint(self, api_client, test_user_token):
        """POST /api/ai/chat accepts requests"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        payload = {
            "message": "What is the Pythagorean theorem?",
            "subject_context": "Mathematics"
        }
        
        response = api_client.post(f"{BASE_URL}/api/ai/chat", json=payload, headers=headers)
        
        # AI might fail due to API key issues, but endpoint should respond
        if response.status_code == 200:
            data = response.json()
            assert 'response' in data
            assert 'session_id' in data
            print(f"✓ AI chat endpoint working - response received")
        elif response.status_code == 500:
            print("⚠ AI chat endpoint exists but AI service may be unavailable")
        else:
            assert False, f"Unexpected status code: {response.status_code}"

    def test_ai_explain_endpoint(self, api_client, test_user_token):
        """POST /api/ai/explain accepts requests"""
        # Get a question first
        questions_response = api_client.get(f"{BASE_URL}/api/questions?subject_id=see_math&limit=1")
        questions = questions_response.json()
        
        if len(questions) == 0:
            pytest.skip("No questions available")
        
        question = questions[0]
        
        headers = {"Authorization": f"Bearer {test_user_token}"}
        payload = {
            "question_id": question['question_id']
        }
        
        response = api_client.post(f"{BASE_URL}/api/ai/explain", json=payload, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'explanation' in data
            print(f"✓ AI explain endpoint working")
        elif response.status_code == 500:
            print("⚠ AI explain endpoint exists but AI service may be unavailable")
        else:
            assert False, f"Unexpected status code: {response.status_code}"

# ==================== REFERRAL TESTS ====================

class TestReferral:
    """Referral system tests - registration with code, apply code, info endpoint"""
    
    def test_register_with_referral_code(self, api_client):
        """POST /api/auth/register with referral_code grants premium to both users"""
        # Create referrer user first
        referrer_email = f"referrer_{os.urandom(4).hex()}@examace.com"
        referrer_payload = {
            "name": "Referrer User",
            "email": referrer_email,
            "password": "Referrer123",
            "exam_type": "SEE"
        }
        
        referrer_response = api_client.post(f"{BASE_URL}/api/auth/register", json=referrer_payload)
        assert referrer_response.status_code in [200, 201]
        referrer_data = referrer_response.json()
        referrer_code = referrer_data['user']['referral_code']
        referrer_token = referrer_data['token']
        
        print(f"✓ Referrer created with code: {referrer_code}")
        
        # Create referee user with referral code
        referee_email = f"referee_{os.urandom(4).hex()}@examace.com"
        referee_payload = {
            "name": "Referee User",
            "email": referee_email,
            "password": "Referee123",
            "exam_type": "SEE",
            "referral_code": referrer_code
        }
        
        referee_response = api_client.post(f"{BASE_URL}/api/auth/register", json=referee_payload)
        assert referee_response.status_code in [200, 201]
        referee_data = referee_response.json()
        
        # Verify referee got premium
        assert referee_data['user']['subscription_status'] == 'premium', "Referee should get premium"
        print(f"✓ Referee registered with referral code and got premium")
        
        # Verify referrer got premium by checking /api/referral/info
        headers = {"Authorization": f"Bearer {referrer_token}"}
        info_response = api_client.get(f"{BASE_URL}/api/referral/info", headers=headers)
        assert info_response.status_code == 200
        info_data = info_response.json()
        
        assert info_data['referral_count'] >= 1, "Referrer should have at least 1 referral"
        assert info_data['subscription_status'] == 'premium', "Referrer should get premium"
        print(f"✓ Referrer got premium - referral count: {info_data['referral_count']}")
    
    def test_referral_info_endpoint(self, api_client, test_user_token):
        """GET /api/referral/info returns referral data"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/referral/info", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'referral_code' in data
        assert 'referral_count' in data
        assert 'referred_users' in data
        assert 'subscription_status' in data
        assert 'premium_expires' in data
        
        assert len(data['referral_code']) == 6, "Referral code should be 6 characters"
        assert isinstance(data['referral_count'], int)
        assert isinstance(data['referred_users'], list)
        print(f"✓ Referral info endpoint working - code: {data['referral_code']}, count: {data['referral_count']}")
    
    def test_apply_referral_code_valid(self, api_client):
        """POST /api/referral/apply with valid code grants premium"""
        # Create referrer
        referrer_email = f"ref_apply_{os.urandom(4).hex()}@examace.com"
        referrer_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Referrer",
            "email": referrer_email,
            "password": "Test123",
            "exam_type": "SEE"
        })
        referrer_data = referrer_response.json()
        referrer_code = referrer_data['user']['referral_code']
        
        # Create user who will apply code
        user_email = f"user_apply_{os.urandom(4).hex()}@examace.com"
        user_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "User",
            "email": user_email,
            "password": "Test123",
            "exam_type": "SEE"
        })
        user_data = user_response.json()
        user_token = user_data['token']
        
        # Apply referral code
        headers = {"Authorization": f"Bearer {user_token}"}
        apply_response = api_client.post(f"{BASE_URL}/api/referral/apply", 
            json={"referral_code": referrer_code}, headers=headers)
        
        assert apply_response.status_code == 200
        apply_data = apply_response.json()
        
        assert apply_data['success'] == True
        assert 'message' in apply_data
        assert apply_data['user']['subscription_status'] == 'premium'
        print(f"✓ Apply referral code working - user got premium")
    
    def test_apply_referral_code_invalid(self, api_client, test_user_token):
        """POST /api/referral/apply with invalid code fails"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.post(f"{BASE_URL}/api/referral/apply", 
            json={"referral_code": "INVALID"}, headers=headers)
        
        assert response.status_code == 404, "Should reject invalid referral code"
        print("✓ Invalid referral code rejection working")
    
    def test_apply_referral_code_self(self, api_client):
        """POST /api/referral/apply with own code fails"""
        # Create user
        user_email = f"self_ref_{os.urandom(4).hex()}@examace.com"
        user_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Self Referrer",
            "email": user_email,
            "password": "Test123",
            "exam_type": "SEE"
        })
        user_data = user_response.json()
        user_token = user_data['token']
        user_code = user_data['user']['referral_code']
        
        # Try to apply own code
        headers = {"Authorization": f"Bearer {user_token}"}
        response = api_client.post(f"{BASE_URL}/api/referral/apply", 
            json={"referral_code": user_code}, headers=headers)
        
        assert response.status_code == 400, "Should reject self-referral"
        print("✓ Self-referral rejection working")
    
    def test_apply_referral_code_duplicate(self, api_client):
        """POST /api/referral/apply when already used fails"""
        # Create referrer
        referrer_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Referrer",
            "email": f"ref_dup_{os.urandom(4).hex()}@examace.com",
            "password": "Test123",
            "exam_type": "SEE"
        })
        referrer_code = referrer_response.json()['user']['referral_code']
        
        # Create user and apply code
        user_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "User",
            "email": f"user_dup_{os.urandom(4).hex()}@examace.com",
            "password": "Test123",
            "exam_type": "SEE",
            "referral_code": referrer_code  # Apply during registration
        })
        user_token = user_response.json()['token']
        
        # Try to apply another code
        another_referrer = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Another",
            "email": f"another_{os.urandom(4).hex()}@examace.com",
            "password": "Test123",
            "exam_type": "SEE"
        })
        another_code = another_referrer.json()['user']['referral_code']
        
        headers = {"Authorization": f"Bearer {user_token}"}
        response = api_client.post(f"{BASE_URL}/api/referral/apply", 
            json={"referral_code": another_code}, headers=headers)
        
        assert response.status_code == 400, "Should reject duplicate referral usage"
        print("✓ Duplicate referral rejection working")

# ==================== CACHE TESTS ====================

class TestCache:
    """Offline cache endpoint tests"""
    
    def test_cache_content_endpoint(self, api_client):
        """GET /api/cache/content returns all cacheable content"""
        response = api_client.get(f"{BASE_URL}/api/cache/content")
        
        assert response.status_code == 200
        data = response.json()
        
        assert 'subjects' in data
        assert 'chapters' in data
        assert 'questions' in data
        assert 'cached_at' in data
        
        assert isinstance(data['subjects'], list)
        assert isinstance(data['chapters'], list)
        assert isinstance(data['questions'], list)
        
        print(f"✓ Cache content endpoint working - {len(data['subjects'])} subjects, {len(data['chapters'])} chapters, {len(data['questions'])} questions")
    
    def test_cache_content_filtered_by_exam(self, api_client):
        """GET /api/cache/content?exam_id=see filters by exam"""
        response = api_client.get(f"{BASE_URL}/api/cache/content?exam_id=see")
        
        assert response.status_code == 200
        data = response.json()
        
        # All subjects should be for SEE exam
        for subject in data['subjects']:
            assert subject['exam_id'] == 'see'
        
        print(f"✓ Cache content filtering working - {len(data['subjects'])} SEE subjects")
