"""Turning recorded clips into labelled frames."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from extract_video_frames import extract_frames, main, parse_clip_name, plan_output_dir


@pytest.mark.parametrize(
    "name,person,label",
    [
        ("riya_seatedtwist_side.mp4", "riya", "seated_twist"),
        ("Arjun_updog_front.MOV", "arjun", "upward_dog"),
        ("meera-cobra-left.mp4", "meera", "cobra_pose"),
        ("dad_prayer.mp4", "dad", "pranamasana"),
        ("sam_seated_twist.mp4", "sam", "seated_twist"),
    ],
)
def test_clip_names_map_to_canonical_labels(name: str, person: str, label: str) -> None:
    clip = parse_clip_name(Path(name))
    assert (clip.person, clip.label) == (person, label)


def test_unknown_pose_is_rejected_with_a_helpful_message() -> None:
    with pytest.raises(ValueError, match="unknown pose 'headstand'"):
        parse_clip_name(Path("riya_headstand_side.mp4"))


def test_held_out_people_go_to_the_test_root(tmp_path: Path) -> None:
    clip = parse_clip_name(Path("riya_cobra_side.mp4"))
    other = parse_clip_name(Path("sam_cobra_side.mp4"))
    kwargs = dict(train_root=tmp_path / "train", test_root=tmp_path / "test")

    assert plan_output_dir(clip, ["riya"], **kwargs) == tmp_path / "test" / "cobra_pose"
    assert plan_output_dir(other, ["riya"], **kwargs) == tmp_path / "train" / "cobra_pose"


def _write_video(path: Path, seconds: float = 3.0, fps: int = 10) -> bool:
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    if not writer.isOpened():
        return False
    for i in range(int(seconds * fps)):
        writer.write(np.full((48, 64, 3), (i * 7) % 255, dtype=np.uint8))
    writer.release()
    return path.exists() and path.stat().st_size > 0


def test_frames_are_sampled_and_capped(tmp_path: Path) -> None:
    video = tmp_path / "riya_cobra_side.avi"
    if not _write_video(video):
        pytest.skip("no MJPG video writer in this OpenCV build")

    out = tmp_path / "out"
    written = extract_frames(parse_clip_name(video), out, interval_sec=0.5, max_frames=4)

    files = sorted(p.name for p in out.glob("*.jpg"))
    assert written == 4
    assert files[0] == "riya_cobra_side_f0000.jpg"
    assert len(files) == 4


def test_frame_names_do_not_look_like_mislabelled_synthetic_frames(tmp_path: Path) -> None:
    """The dataset's label-conflict rule must not reject our own frames."""
    from utils.dataset import filename_label_conflict

    assert filename_label_conflict(Path("riya_cobra_side_f0003.jpg"), "cobra_pose") is None
    assert filename_label_conflict(Path("riya_updog_side_f0003.jpg"), "upward_dog") is None


def test_dry_run_writes_nothing(tmp_path: Path, capsys) -> None:
    videos = tmp_path / "videos"
    videos.mkdir()
    (videos / "riya_cobra_side.mp4").write_bytes(b"not really a video")

    assert main(["--videos", str(videos), "--test-people", "riya", "--dry-run"]) == 0
    assert "test  cobra_pose" in capsys.readouterr().out
