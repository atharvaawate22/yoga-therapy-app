"""GET /health — the k8s probe target and the app's reachability check."""

from __future__ import annotations

from fastapi.testclient import TestClient

import yoga_pose_engine as engine


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "yoga-pose-engine"


def test_health_reports_model_availability(client: TestClient) -> None:
    body = client.get("/health").json()

    for key in ("classifier_ready", "classifier_loaded", "movenet_present"):
        assert key in body, f"probe payload missing {key}"
        assert isinstance(body[key], bool)


def test_health_does_not_load_models() -> None:
    """Probing must stay cheap.

    Health is polled by kubelet and by the mobile app on every screen open. If
    it forced a load it would pull ~9 MB of model into memory — or trigger
    bootstrap training — on the first probe.
    """
    with TestClient(engine.app) as bare_client:  # no dependency overrides
        assert bare_client.get("/health").status_code == 200

    assert engine._movenet_runtime is None
    assert engine._classifier_runtime is None
