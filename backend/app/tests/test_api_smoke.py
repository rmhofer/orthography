from fastapi.testclient import TestClient

from app.main import app


def test_health_and_bootstrap_flow() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        start = client.post("/api/participants/start", json={"recruitmentData": {}})
        token = start.json()["token"]
        bootstrap = client.get(f"/api/participants/{token}/bootstrap")

    assert health.status_code == 200
    assert start.status_code == 200
    assert bootstrap.status_code == 200
    assert bootstrap.json()["participant"]["phase"] == "landing"
