# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  exam_type: 'SEE',
  subscription_status: 'free',
  daily_streak: 5,
  last_active: new Date().toISOString(),
  created_at: new Date().toISOString()
});
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
# Register
curl -X POST "https://ace-tutor-nepal.preview.emergentagent.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "test123456", "exam_type": "SEE"}'

# Login
curl -X POST "https://ace-tutor-nepal.preview.emergentagent.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123456"}'

# Get me (with token from login)
curl -X GET "https://ace-tutor-nepal.preview.emergentagent.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 3: Browser Testing
```javascript
// Navigate to app
await page.goto("https://ace-tutor-nepal.preview.emergentagent.com");
```

## Checklist
- User document has user_id field (custom UUID)
- All queries use `{"_id": 0}` projection
- API returns user data (not 401/404)
- Dashboard loads after login
