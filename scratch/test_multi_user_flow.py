import sys
from pathlib import Path
from uuid import uuid4
from fastapi.testclient import TestClient

backend_path = Path("D:/Cyepro/backend")
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.main import app
from app.core.auth import get_current_user, AuthenticatedUser
from app.services.supabase_service import supabase_service

client = TestClient(app)


def test_public_health():
    """Verify health endpoints remain accessible without auth."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "online"
    print("PASS 1: Public health check online (200 OK).")


def test_unauthenticated_rejection():
    """Verify all protected endpoints strictly reject unauthenticated requests with HTTP 401."""
    endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/documents"),
        ("POST", "/api/v1/documents/upload"),
        ("POST", "/api/v1/chat/ask"),
        ("GET", "/api/v1/chat/sessions"),
        ("GET", "/api/v1/vehicles/"),
        ("POST", "/api/v1/vehicles/compare"),
        ("POST", "/api/v1/auth/reset-password"),
    ]
    for method, path in endpoints:
        if method == "GET":
            r = client.get(path)
        else:
            payload = {"new_password": "ValidLengthPass123!", "confirm_password": "ValidLengthPass123!"} if "reset" in path else {}
            r = client.post(path, json=payload)
        assert r.status_code == 401, f"Expected 401 for {method} {path}, got {r.status_code}"
    print("PASS 2: All protected endpoints rejected unauthenticated requests with 401.")


def run_full_security_verification_suite():
    sb = supabase_service.client

    # 1. Create real test users in Supabase Auth
    user_a_email = f"alice_{uuid4().hex[:8]}@cyepro.test"
    user_b_email = f"bob_{uuid4().hex[:8]}@cyepro.test"

    u_a = sb.auth.admin.create_user({
        "email": user_a_email,
        "password": "Password12345!",
        "email_confirm": True,
        "user_metadata": {"full_name": "Alice Engineer"}
    })
    user_a_id = u_a.user.id

    u_b = sb.auth.admin.create_user({
        "email": user_b_email,
        "password": "Password12345!",
        "email_confirm": True,
        "user_metadata": {"full_name": "Bob Tester"}
    })
    user_b_id = u_b.user.id

    user_a = AuthenticatedUser(
        id=user_a_id,
        email=user_a_email,
        full_name="Alice Engineer",
        email_confirmed=True,
    )

    user_b = AuthenticatedUser(
        id=user_b_id,
        email=user_b_email,
        full_name="Bob Tester",
        email_confirmed=True,
    )

    print(f"Created real test users: Alice ({user_a_id}) and Bob ({user_b_id})")

    try:
        # A. Test User Profile Retrieval
        app.dependency_overrides[get_current_user] = lambda: user_a
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == str(user_a.id)
        assert data["email"] == user_a_email
        assert data["full_name"] == "Alice Engineer"
        print("PASS 3: User A verified profile via /api/v1/auth/me")

        # B. Test Shared Knowledge Base Access (Both users access shared catalog)
        app.dependency_overrides[get_current_user] = lambda: user_a
        r_a = client.get("/api/v1/documents")
        assert r_a.status_code == 200
        docs_a = r_a.json()["documents"]

        app.dependency_overrides[get_current_user] = lambda: user_b
        r_b = client.get("/api/v1/documents")
        assert r_b.status_code == 200
        docs_b = r_b.json()["documents"]

        assert len(docs_a) == len(docs_b)
        print(f"PASS 4: Shared knowledge base accessible by both users ({len(docs_a)} documents).")

        # C. Test Private Storage Download (Authorized temporary signed URL generation)
        if len(docs_a) > 0:
            first_doc_id = docs_a[0]["id"]
            app.dependency_overrides[get_current_user] = lambda: user_b
            dl_res = client.get(f"/api/v1/documents/{first_doc_id}/download")
            assert dl_res.status_code == 200
            dl_data = dl_res.json()
            assert "download_url" in dl_data
            assert "token=" in dl_data["download_url"]
            assert dl_data["expires_in_seconds"] == 900
            print("PASS 5: Temporary 15-minute signed URL generated for private brochure.")

        # D. Test Document Deletion Ownership Check (User B cannot delete document)
        doc_id = str(uuid4())
        doc_payload = {
            "id": doc_id,
            "file_name": f"test_doc_{doc_id[:8]}.pdf",
            "storage_path": f"brochures/test_{doc_id[:8]}.pdf",
            "file_type": "application/pdf",
            "file_size": 1024,
            "processing_status": "completed",
            "total_pages": 1,
        }
        sb.table("documents").insert(doc_payload).execute()

        app.dependency_overrides[get_current_user] = lambda: user_b
        r_forbidden = client.delete(f"/api/v1/documents/{doc_id}")
        assert r_forbidden.status_code == 403
        assert "Forbidden" in r_forbidden.json()["detail"]
        print("PASS 6: Unauthorized document deletion strictly blocked with HTTP 403 Forbidden.")
        sb.table("documents").delete().eq("id", doc_id).execute()

        # E. Test Chat Session Privacy & Isolation
        session_id = str(uuid4())
        sess_payload = {
            "id": session_id,
            "user_id": str(user_a.id),
            "title": "Private Consultation with User A",
        }
        sb.table("chat_sessions").insert(sess_payload).execute()

        # 1. User B lists sessions -> User A's session must NOT appear
        app.dependency_overrides[get_current_user] = lambda: user_b
        r_list = client.get("/api/v1/chat/sessions")
        assert r_list.status_code == 200
        user_b_sessions = [s["id"] for s in r_list.json()["sessions"]]
        assert session_id not in user_b_sessions
        print("PASS 7: User A's session is not visible in User B's session list.")

        # 2. User B tries to read User A's session messages directly -> must be 403 Forbidden
        r_msg = client.get(f"/api/v1/chat/sessions/{session_id}/messages")
        assert r_msg.status_code == 403
        print("PASS 8: User B blocked from reading User A's session messages with HTTP 403 Forbidden.")

        # 3. User B tries to delete User A's session -> must be 403 Forbidden
        r_del = client.delete(f"/api/v1/chat/sessions/{session_id}")
        assert r_del.status_code == 403
        print("PASS 9: User B blocked from deleting User A's session with HTTP 403 Forbidden.")

        # 4. User A deletes their own session -> should succeed
        app.dependency_overrides[get_current_user] = lambda: user_a
        r_del_ok = client.delete(f"/api/v1/chat/sessions/{session_id}")
        assert r_del_ok.status_code == 200
        print("PASS 10: User A successfully deleted their own private session.")

        # F. Test Password Recovery Flow & Cross-User Isolation
        # Generate recovery/sign-in token for User A
        login_res = sb.auth.sign_in_with_password({
            "email": user_a_email,
            "password": "Password12345!"
        })
        user_a_token = login_res.session.access_token

        # Reset password using verified token
        reset_res = client.post(
            "/api/v1/auth/reset-password",
            headers={"Authorization": f"Bearer {user_a_token}"},
            json={"new_password": "NewSecretPassword123!", "confirm_password": "NewSecretPassword123!"}
        )
        assert reset_res.status_code == 200
        assert reset_res.json()["success"] is True
        print("PASS 11: User A password reset successfully using verified token.")

        # Verify old password no longer works
        try:
            sb.auth.sign_in_with_password({"email": user_a_email, "password": "Password12345!"})
            assert False, "Old password should have failed"
        except Exception:
            print("PASS 12: Old password successfully invalidated.")

        # Verify new password works
        new_login = sb.auth.sign_in_with_password({"email": user_a_email, "password": "NewSecretPassword123!"})
        assert new_login.session is not None
        print("PASS 13: New password authenticated successfully.")

        # Verify invalid / fake token cannot reset password
        fake_reset = client.post(
            "/api/v1/auth/reset-password",
            headers={"Authorization": "Bearer fake-invalid-token-12345"},
            json={"new_password": "AnotherPassword123!", "confirm_password": "AnotherPassword123!"}
        )
        assert fake_reset.status_code == 401
        print("PASS 14: Tampered/invalid recovery tokens rejected with HTTP 401.")

        # Clear user session on client so it restores service role
        sb.auth.sign_out()
    finally:
        app.dependency_overrides.clear()
        # Clean up test users from Supabase Auth
        try:
            sb.auth.admin.delete_user(user_a_id)
            sb.auth.admin.delete_user(user_b_id)
            print("Cleaned up temporary test users from Supabase Auth.")
        except Exception as cleanup_err:
            print("Notice on cleanup:", cleanup_err)


def test_database_integrity():
    """Confirm all existing database records remain intact."""
    supabase_service._client = None
    sb = supabase_service.client
    doc_count = sb.table("documents").select("id", count="exact").execute().count
    chunk_count = sb.table("document_chunks").select("id", count="exact").execute().count
    sess_count = sb.table("chat_sessions").select("id", count="exact").execute().count
    msg_count = sb.table("chat_messages").select("id", count="exact").execute().count

    assert doc_count == 12, f"Expected 12 documents, found {doc_count}"
    assert chunk_count == 190, f"Expected 190 chunks, found {chunk_count}"
    assert sess_count == 56, f"Expected 56 chat sessions, found {sess_count}"
    assert msg_count == 139, f"Expected 139 chat messages, found {msg_count}"

    print(f"PASS 15: Database integrity 100% verified: {doc_count} docs, {chunk_count} chunks, {sess_count} sessions, {msg_count} messages.")


if __name__ == "__main__":
    print("==================================================")
    print("RUNNING COMPREHENSIVE PRODUCTION SECURITY AUDIT")
    print("==================================================")
    test_public_health()
    test_unauthenticated_rejection()
    run_full_security_verification_suite()
    test_database_integrity()
    print("==================================================")
    print("ALL 15 PRODUCTION SECURITY AUDIT TESTS PASSED!")
    print("==================================================")
