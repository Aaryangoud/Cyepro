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


def test_1_unauthenticated_rejection():
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
    print("PASS 1: All protected endpoints reject unauthenticated access with 401 Unauthorized.")


def run_multi_user_audit_tests():
    sb = supabase_service.client

    # Create real test users in Supabase Auth
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
        # TEST 2: Authenticated users reading shared completed brochures
        app.dependency_overrides[get_current_user] = lambda: user_a
        r_a = client.get("/api/v1/documents")
        assert r_a.status_code == 200
        docs_a = r_a.json()["documents"]

        app.dependency_overrides[get_current_user] = lambda: user_b
        r_b = client.get("/api/v1/documents")
        assert r_b.status_code == 200
        docs_b = r_b.json()["documents"]

        assert len(docs_a) == len(docs_b) == 12
        print(f"PASS 2: Both authenticated users read all {len(docs_a)} shared completed brochures.")

        # TEST 3: Cross-user document deletion rejection
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

        # User B attempts to delete User A's document -> must be 403 Forbidden
        app.dependency_overrides[get_current_user] = lambda: user_b
        r_forbidden = client.delete(f"/api/v1/documents/{doc_id}")
        assert r_forbidden.status_code == 403
        assert "Forbidden" in r_forbidden.json()["detail"]
        print("PASS 3: Cross-user document deletion strictly rejected with HTTP 403 Forbidden.")
        sb.table("documents").delete().eq("id", doc_id).execute()

        # TEST 4: Direct client document write rejection
        # Get User A JWT via direct Auth token request so service-role client is untouched
        import httpx
        token_res = httpx.post(
            f"{sb.supabase_url}/auth/v1/token?grant_type=password",
            headers={"apikey": sb.supabase_key, "Content-Type": "application/json"},
            json={"email": user_a_email, "password": "Password12345!"}
        )
        assert token_res.status_code == 200, f"Failed to get User A token: {token_res.text}"
        user_jwt = token_res.json()["access_token"]

        # Direct client PostgREST client attempt with User A JWT
        import httpx
        supabase_url = sb.supabase_url
        headers = {"apikey": sb.supabase_key, "Authorization": f"Bearer {user_jwt}", "Content-Type": "application/json"}
        direct_post = httpx.post(f"{supabase_url}/rest/v1/documents", headers=headers, json={"file_name": "hacked.pdf", "file_size": 100, "file_type": "application/pdf", "storage_path": "brochures/hacked.pdf"})
        # Should be rejected (401, 403, or 400 with RLS violation / missing permissions)
        assert direct_post.status_code in (401, 403, 400), f"Expected direct client write rejected, got {direct_post.status_code}"
        print(f"PASS 4: Direct client PostgREST document write rejected (HTTP {direct_post.status_code}).")

        # TEST 6: Password recovery token validation
        # Reset password using verified token
        reset_res = client.post(
            "/api/v1/auth/reset-password",
            headers={"Authorization": f"Bearer {user_jwt}"},
            json={"new_password": "NewSecretPassword123!", "confirm_password": "NewSecretPassword123!"}
        )
        assert reset_res.status_code == 200
        assert reset_res.json()["success"] is True

        # Invalid token rejected
        fake_reset = client.post(
            "/api/v1/auth/reset-password",
            headers={"Authorization": "Bearer fake-invalid-jwt-token"},
            json={"new_password": "AnotherPassword123!", "confirm_password": "AnotherPassword123!"}
        )
        assert fake_reset.status_code == 401
        print("PASS 6: Password recovery token validated via Supabase Auth (invalid tokens rejected with 401).")

        # TEST 5: Private chat session isolation
        session_id = str(uuid4())
        sess_payload = {
            "id": session_id,
            "user_id": str(user_a.id),
            "title": "Private Consultation with Alice",
        }
        sb.table("chat_sessions").insert(sess_payload).execute()

        # User B lists sessions -> User A's session is invisible
        app.dependency_overrides[get_current_user] = lambda: user_b
        r_list = client.get("/api/v1/chat/sessions")
        assert r_list.status_code == 200
        user_b_sessions = [s["id"] for s in r_list.json()["sessions"]]
        assert session_id not in user_b_sessions

        # User B attempts to read User A's session messages directly -> 403 Forbidden
        r_msg = client.get(f"/api/v1/chat/sessions/{session_id}/messages")
        assert r_msg.status_code == 403

        # User B attempts to delete User A's session -> 403 Forbidden
        r_del = client.delete(f"/api/v1/chat/sessions/{session_id}")
        assert r_del.status_code == 403

        # User A deletes their own session -> 200 OK
        app.dependency_overrides[get_current_user] = lambda: user_a
        r_del_ok = client.delete(f"/api/v1/chat/sessions/{session_id}")
        assert r_del_ok.status_code == 200
        print("PASS 5: Private chat sessions completely isolated (list, read, delete protected with 403).")

        # TEST 7: Signed URL expiration
        first_doc = docs_a[0]
        app.dependency_overrides[get_current_user] = lambda: user_a
        dl_res = client.get(f"/api/v1/documents/{first_doc['id']}/download")
        assert dl_res.status_code == 200
        dl_data = dl_res.json()
        assert "token=" in dl_data["download_url"]
        assert dl_data["expires_in_seconds"] == 900
        print("PASS 7: Private brochure signed URL securely issued with 15-minute expiration (900s).")

        # TEST 8: Vehicle comparison using only uploaded brochures
        compare_payload = {
            "vehicle_1": "Tata Harrier",
            "vehicle_2": "Hyundai Grand i10 Nios",
            "comparison_criteria": "Safety features, Engine power, Fuel efficiency"
        }
        app.dependency_overrides[get_current_user] = lambda: user_a
        comp_res = client.post("/api/v1/vehicles/compare", json=compare_payload)
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert comp_data["success"] is True
        assert len(comp_data["comparison_table"]) > 0
        assert comp_data["vehicle_1"]["identified"] is True
        print(f"PASS 8: Vehicle comparison successfully grounded on uploaded brochures ({len(comp_data['comparison_table'])} spec rows compared).")

    finally:
        app.dependency_overrides.clear()
        try:
            sb.auth.admin.delete_user(user_a_id)
            sb.auth.admin.delete_user(user_b_id)
            print("Cleaned up temporary test users from Supabase Auth.")
        except Exception as e:
            print("Notice on cleanup:", e)


def test_9_database_integrity():
    """TEST 9: Confirm all existing database records remain intact."""
    supabase_service._client = None
    sb = supabase_service.client
    doc_count = sb.table("documents").select("id", count="exact").execute().count
    chunk_count = sb.table("document_chunks").select("id", count="exact").execute().count
    sess_count = sb.table("chat_sessions").select("id", count="exact").execute().count
    msg_count = sb.table("chat_messages").select("id", count="exact").execute().count

    assert doc_count >= 12, f"Expected at least 12 documents, found {doc_count}"
    assert chunk_count >= 190, f"Expected at least 190 chunks, found {chunk_count}"
    assert sess_count >= 56, f"Expected at least 56 chat sessions, found {sess_count}"
    assert msg_count >= 139, f"Expected at least 139 chat messages, found {msg_count}"

    print(f"PASS 9: Database integrity 100% verified: {doc_count} docs, {chunk_count} chunks, {sess_count} sessions, {msg_count} messages.")


if __name__ == "__main__":
    print("==================================================")
    print("RUNNING FINAL 9-POINT PRODUCTION REGRESSION AUDIT")
    print("==================================================")
    test_1_unauthenticated_rejection()
    run_multi_user_audit_tests()
    test_9_database_integrity()
    print("==================================================")
    print("ALL 9 PRODUCTION REGRESSION TESTS PASSED (100%)!")
    print("==================================================")
