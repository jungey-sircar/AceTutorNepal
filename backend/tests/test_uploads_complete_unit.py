import sys
import os
import asyncio
from types import SimpleNamespace

# Ensure backend package path is importable
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Ensure minimal env vars so server module can import without KeyError
os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'examace_test')

# Some server top-level imports rely on optional packages. Provide lightweight fakes so we can import server for unit tests.
if 'emergentintegrations' not in sys.modules:
    # Create fake emergentintegrations.llm.chat with LlmChat and UserMessage
    fake_chat = SimpleNamespace(LlmChat=lambda *a, **k: None, UserMessage=lambda *a, **k: None)
    fake_llm = SimpleNamespace(chat=fake_chat)
    fake_pkg = SimpleNamespace(llm=fake_llm)
    sys.modules['emergentintegrations'] = fake_pkg
    sys.modules['emergentintegrations.llm'] = fake_llm
    sys.modules['emergentintegrations.llm.chat'] = fake_chat

import server


def make_fake_boto3(content_length=4096):
    def client(service, region_name=None):
        class FakeClient:
            def head_object(self, Bucket, Key):
                return {'ContentLength': content_length}

            def generate_presigned_url(self, operation_name, Params=None, ExpiresIn=3600):
                key = (Params or {}).get('Key', 'uploads/fake.bin')
                return f'https://example.com/{key}?expires={ExpiresIn}&op={operation_name}'
        return FakeClient()

    return SimpleNamespace(client=client)


def test_complete_upload_without_s3(monkeypatch):
    """When AWS_S3_BUCKET is not configured, upload registers without calling S3."""
    # Ensure no S3 bucket
    monkeypatch.setattr(server, 'AWS_S3_BUCKET', '')

    captured = {}

    async def fake_insert_one(doc):
        captured['doc'] = doc

    # Patch DB uploads insert
    monkeypatch.setattr(server, 'db', server.db)
    # Ensure uploads collection exists on db mock if missing
    if not hasattr(server.db, 'uploads'):
        class DummyUploads:
            async def insert_one(self, doc):
                captured['doc'] = doc
        server.db.uploads = DummyUploads()
    else:
        monkeypatch.setattr(server.db.uploads, 'insert_one', fake_insert_one)

    data = {'object_key': 'uploads/test_no_s3.pdf', 'file_name': 'test_no_s3.pdf', 'content_type': 'application/pdf'}
    user = {'user_id': 'teacher_1', 'name': 'Teacher One'}

    result = asyncio.run(server.complete_upload(data, user))

    assert result['object_key'] == data['object_key']
    assert result['url'] == data['object_key']
    assert result['success'] is True


def test_complete_upload_with_s3_mock(monkeypatch):
    """When AWS_S3_BUCKET is configured, server should call S3 head_object (mocked) and return size."""
    monkeypatch.setattr(server, 'AWS_S3_BUCKET', 'test-bucket')
    monkeypatch.setattr(server, 'AWS_REGION', 'us-east-1')

    # Inject fake boto3 module into sys.modules so server's local import picks it up
    fake_boto3 = make_fake_boto3(content_length=12345)
    monkeypatch.setitem(sys.modules, 'boto3', fake_boto3)

    captured = {}

    async def fake_insert_one(doc):
        captured['doc'] = doc

    # Patch db.uploads.insert_one
    if not hasattr(server.db, 'uploads'):
        class DummyUploads:
            async def insert_one(self, doc):
                captured['doc'] = doc
        server.db.uploads = DummyUploads()
    else:
        monkeypatch.setattr(server.db.uploads, 'insert_one', fake_insert_one)

    data = {'object_key': 'uploads/test_with_s3.pdf', 'file_name': 'test_with_s3.pdf', 'content_type': 'application/pdf'}
    user = {'user_id': 'teacher_2', 'name': 'Teacher Two'}

    result = asyncio.run(server.complete_upload(data, user))

    assert result['object_key'] == data['object_key']
    # Should construct a public URL since AWS_S3_BUCKET set
    assert result['url'] is not None
    assert result['size'] == 12345
    assert result['success'] is True


def test_get_s3_signed_url_without_bucket_raises(monkeypatch):
    """Presign endpoint should reject requests when AWS_S3_BUCKET is missing."""
    monkeypatch.setattr(server, 'AWS_S3_BUCKET', '')

    try:
        asyncio.run(server.get_s3_signed_url(file_name='test.pdf', content_type='application/pdf'))
        assert False, 'Expected HTTPException'
    except Exception as exc:
        assert exc.__class__.__name__ == 'HTTPException'


def test_get_s3_signed_url_with_mock_boto3(monkeypatch):
    """Presign endpoint should return upload_url/object_key/public_url when boto3 is mocked."""
    monkeypatch.setattr(server, 'AWS_S3_BUCKET', 'test-bucket')
    monkeypatch.setattr(server, 'AWS_REGION', 'us-east-1')
    monkeypatch.setitem(sys.modules, 'boto3', make_fake_boto3())

    result = asyncio.run(server.get_s3_signed_url(file_name='teacher-notes.pdf', content_type='application/pdf', acl='public-read'))

    assert 'upload_url' in result
    assert 'object_key' in result
    assert result['upload_url'].startswith('https://example.com/uploads/')
    assert result['public_url'] == f"https://test-bucket.s3.us-east-1.amazonaws.com/{result['object_key']}"
    assert result['expires_in'] == 3600


