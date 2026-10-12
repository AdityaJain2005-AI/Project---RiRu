import os

os.environ["ML_SERVICE_TOKEN"] = "test-token"

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_rejects_missing_token() -> None:
    response = client.get("/internal/v1/health")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "UNAUTHORIZED"


def test_health_rejects_wrong_token() -> None:
    response = client.get(
        "/internal/v1/health",
        headers={"Authorization": "Bearer no"},
    )
    assert response.status_code == 401


def test_health_ok() -> None:
    response = client.get(
        "/internal/v1/health",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "riru-ml"}
