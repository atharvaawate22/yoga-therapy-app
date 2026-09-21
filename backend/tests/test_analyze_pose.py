"""POST /analyze-pose — the request path end to end, with stubbed models."""

from __future__ import annotations

import base64

import pytest
from fastapi.testclient import TestClient

from conftest import StubClassifier, StubMoveNet, make_movenet_output

ANALYZE = "/analyze-pose"


def payload(image_b64: str, **overrides) -> dict:
    body = {"image_base64": image_b64, "source": "image", "experience_level": "beginner"}
    body.update(overrides)
    return body


# ── Happy path ────────────────────────────────────────────────────────────


def test_confident_prediction_returns_pose(client: TestClient, sample_image_base64) -> None:
    response = client.post(ANALYZE, json=payload(sample_image_base64))

    assert response.status_code == 200
    body = response.json()
    assert body["pose"] == "warrior_pose"
    assert body["confidence"] == pytest.approx(0.95, abs=1e-3)
    assert body["corrections"], "a detected pose must come with at least one cue"
    assert body["debug_image_base64"], "skeleton overlay should be returned"


def test_response_includes_full_probability_distribution(
    client: TestClient, sample_image_base64
) -> None:
    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert set(body["probabilities"]) == {"warrior_pose", "tree_pose", "chair_pose"}


def test_warrior_pose_reports_distance_metrics(
    client: TestClient, sample_image_base64
) -> None:
    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert set(body["distances"]) == {
        "warrior_arm_lateral",
        "warrior_arm_vertical",
        "warrior_arm_depth",
    }


# ── Confidence gate ───────────────────────────────────────────────────────


def test_low_confidence_is_rejected_as_nopose(make_client, sample_image_base64) -> None:
    """Below MIN_CLASS_PROB we decline rather than guess."""
    client = make_client(
        classifier=StubClassifier({"warrior_pose": 0.42, "tree_pose": 0.38})
    )

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "nopose"
    assert body["confidence"] == 0.0
    # The distribution is still returned so a caller can inspect the near-miss.
    assert body["probabilities"]["warrior_pose"] == pytest.approx(0.42, abs=1e-3)


def test_confidence_exactly_at_threshold_is_accepted(
    make_client, sample_image_base64
) -> None:
    client = make_client(classifier=StubClassifier({"tree_pose": 0.70, "chair_pose": 0.30}))

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "tree_pose"


def test_unknown_class_maps_to_nopose(make_client, sample_image_base64) -> None:
    """The trained `unknown` class must never surface as a pose name."""
    client = make_client(classifier=StubClassifier({"unknown": 0.99, "tree_pose": 0.01}))

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "nopose"


def test_classifier_unavailable_is_reported(make_client, sample_image_base64) -> None:
    client = make_client(classifier=StubClassifier({}))

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "nopose"
    assert "Classifier model not found" in body["corrections"][0]


# ── Body-presence gate ────────────────────────────────────────────────────


def test_low_visibility_frame_is_rejected(make_client, sample_image_base64) -> None:
    client = make_client(movenet=StubMoveNet(make_movenet_output(score=0.05)))

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "nopose"
    assert "No full-body skeleton detected" in body["corrections"][0]


def test_missing_torso_is_rejected(make_client, sample_image_base64) -> None:
    """Legs visible but hips/shoulders not — the core gate must reject."""
    faded_core = {idx: (0.5, 0.5, 0.05) for idx in (5, 6, 11, 12)}
    client = make_client(
        movenet=StubMoveNet(make_movenet_output(score=0.9, overrides=faded_core))
    )

    body = client.post(ANALYZE, json=payload(sample_image_base64)).json()

    assert body["pose"] == "nopose"


# ── Temporal stability filter (live mode) ─────────────────────────────────


def test_live_mode_requires_majority_before_committing(
    client: TestClient, sample_image_base64
) -> None:
    """A pose needs 3 of the last 5 live frames before it is reported."""
    body = payload(sample_image_base64, source="live", session_id="s-1")

    first = client.post(ANALYZE, json=body).json()
    second = client.post(ANALYZE, json=body).json()
    third = client.post(ANALYZE, json=body).json()

    assert first["pose"] == "nopose"
    assert second["pose"] == "nopose"
    assert third["pose"] == "warrior_pose"


def test_still_image_mode_commits_immediately(
    client: TestClient, sample_image_base64
) -> None:
    body = client.post(
        ANALYZE, json=payload(sample_image_base64, source="image")
    ).json()

    assert body["pose"] == "warrior_pose"


def test_live_sessions_do_not_share_vote_history(
    client: TestClient, sample_image_base64
) -> None:
    for _ in range(3):
        client.post(ANALYZE, json=payload(sample_image_base64, source="live", session_id="a"))

    other = client.post(
        ANALYZE, json=payload(sample_image_base64, source="live", session_id="b")
    ).json()

    assert other["pose"] == "nopose", "session b must not inherit session a's votes"


# ── Experience levels ─────────────────────────────────────────────────────


@pytest.mark.parametrize("level", ["beginner", "intermediate", "expert"])
def test_all_experience_levels_are_accepted(
    client: TestClient, sample_image_base64, level: str
) -> None:
    response = client.post(
        ANALYZE, json=payload(sample_image_base64, experience_level=level)
    )

    assert response.status_code == 200
    assert response.json()["corrections"]


def test_expert_feedback_is_capped_at_two_cues(
    client: TestClient, sample_image_base64
) -> None:
    body = client.post(
        ANALYZE, json=payload(sample_image_base64, experience_level="expert")
    ).json()

    assert len(body["corrections"]) <= 2


def test_unknown_experience_level_falls_back_to_beginner(
    client: TestClient, sample_image_base64
) -> None:
    """Deliberately lenient: a live practice loop should not hard-fail here."""
    response = client.post(
        ANALYZE, json=payload(sample_image_base64, experience_level="grandmaster")
    )

    assert response.status_code == 200
    assert response.json()["pose"] == "warrior_pose"


# ── Malformed input ───────────────────────────────────────────────────────


def test_missing_image_field_returns_422(client: TestClient) -> None:
    """Schema violation — FastAPI validation rejects before the handler runs."""
    response = client.post(ANALYZE, json={"source": "image"})

    assert response.status_code == 422


def test_empty_image_returns_400(client: TestClient) -> None:
    """Schema-valid but semantically empty — the handler's own guard."""
    response = client.post(ANALYZE, json=payload("   "))

    assert response.status_code == 400
    assert "image_base64 is required" in response.json()["detail"]


def test_non_image_payload_returns_400(client: TestClient) -> None:
    not_an_image = base64.b64encode(b"this is plain text, not a JPEG").decode("ascii")

    response = client.post(ANALYZE, json=payload(not_an_image))

    assert response.status_code == 400
    assert "decode" in response.json()["detail"].lower()


def test_garbage_base64_returns_400(client: TestClient) -> None:
    response = client.post(ANALYZE, json=payload("!!!!not-base64!!!!"))

    assert response.status_code == 400


def test_data_url_prefix_is_stripped(client: TestClient, sample_image_base64) -> None:
    """Browsers/RN send `data:image/jpeg;base64,...` — the prefix must be handled."""
    response = client.post(
        ANALYZE, json=payload(f"data:image/jpeg;base64,{sample_image_base64}")
    )

    assert response.status_code == 200
    assert response.json()["pose"] == "warrior_pose"


# ── Removed field ─────────────────────────────────────────────────────────


def test_legacy_crop_confirmed_field_is_ignored(
    client: TestClient, sample_image_base64
) -> None:
    """Older app builds still send `crop_confirmed`; it must not break them.

    The field was removed from the schema. Pydantic ignores unknown keys by
    default, so shipped clients keep working without a rebuild.
    """
    response = client.post(
        ANALYZE, json=payload(sample_image_base64, crop_confirmed=True)
    )

    assert response.status_code == 200
    assert response.json()["pose"] == "warrior_pose"


def test_request_without_crop_confirmed_is_analyzed(
    client: TestClient, sample_image_base64
) -> None:
    """Previously a missing/false flag short-circuited to nopose."""
    response = client.post(ANALYZE, json=payload(sample_image_base64))

    assert response.json()["pose"] == "warrior_pose"
