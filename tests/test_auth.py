import unittest

from fastapi.testclient import TestClient

from src.app import app


class AuthFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_guest_cannot_manage_activities(self) -> None:
        signup_response = self.client.post(
            "/activities/Chess Club/signup",
            params={"email": "student@example.com"},
        )
        self.assertEqual(signup_response.status_code, 401)

        unregister_response = self.client.delete(
            "/activities/Chess Club/unregister",
            params={"email": "michael@mergington.edu"},
        )
        self.assertEqual(unregister_response.status_code, 401)

    def test_teacher_login_allows_signup(self) -> None:
        login_response = self.client.post(
            "/login",
            json={"username": "ms.chen", "password": "mergington123"},
        )
        self.assertEqual(login_response.status_code, 200)

        token = login_response.json()["token"]
        signup_response = self.client.post(
            "/activities/Chess Club/signup",
            params={"email": "student@example.com"},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(signup_response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
