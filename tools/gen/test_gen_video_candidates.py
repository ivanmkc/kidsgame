"""Unit tests for gen_video_candidates.py."""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import types as pytypes
import unittest
from pathlib import Path
from unittest.mock import MagicMock

_TOOLS_DIR = Path(__file__).resolve().parent.parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

# Mock google.genai if not installed in the sandboxed test environment
has_genai = (
    importlib.util.find_spec("google") is not None
    and importlib.util.find_spec("google.genai") is not None
)

if not has_genai:
    mock_google = pytypes.ModuleType("google")
    mock_genai = pytypes.ModuleType("google.genai")
    mock_types = pytypes.ModuleType("google.genai.types")

    class MockImage:
        def __init__(self, image_bytes: bytes, mime_type: str):
            self.image_bytes = image_bytes
            self.mime_type = mime_type

    class MockGenerateVideosConfig:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    mock_types.Image = MockImage
    mock_types.GenerateVideosConfig = MockGenerateVideosConfig
    mock_genai.types = mock_types
    mock_genai.Client = MagicMock
    mock_google.genai = mock_genai

    sys.modules["google"] = mock_google
    sys.modules["google.genai"] = mock_genai
    sys.modules["google.genai.types"] = mock_types

from gen.gen_video_candidates import (
    DEFAULT_MODEL,
    build_video_prompt,
    call_veo,
    find_scene_image,
    load_specs_and_heroes,
    main,
    parse_video_filename,
    read_queue,
    run_video_candidates,
    validate_candidate_path,
)


class FakeOperation:
    def __init__(self, video_bytes: bytes, error: str | None = None):
        self.done = True
        self.error = error
        video_obj = MagicMock()
        video_obj.video_bytes = video_bytes
        gen_vid = MagicMock()
        gen_vid.video = video_obj
        self.response = MagicMock(generated_videos=[gen_vid])


class FakeVeoClient:
    """Fake model client mimicking the google.genai.Client interface."""

    def __init__(self, video_bytes: bytes = b"\x00\x00\x00\x1cftypisomfake-mp4-data"):
        self.video_bytes = video_bytes
        self.calls: list[dict] = []
        self.fail_on: set[str] = set()

        outer = self

        class _Models:
            def generate_videos(self, model, prompt, image, config=None):
                outer.calls.append({
                    "model": model,
                    "prompt": prompt,
                    "image": image,
                    "config": config,
                })
                if any(fail in prompt for fail in outer.fail_on):
                    raise RuntimeError(f"Simulated Veo failure for prompt: {prompt}")
                return FakeOperation(outer.video_bytes)

        self.models = _Models()


class TestParseVideoFilename(unittest.TestCase):
    def test_choices_index(self):
        res = parse_video_filename("public/story-video/luna_start_0.mp4")
        self.assertEqual(res, ("luna", "start", 0))

        res2 = parse_video_filename("story-video/acorn_m2_2.mp4")
        self.assertEqual(res2, ("acorn", "m2", 2))

    def test_ending_video(self):
        res = parse_video_filename("public/story-video/acorn_end_cozy_burrow_end.mp4")
        self.assertEqual(res, ("acorn", "end_cozy_burrow", -1))

    def test_scare_video(self):
        res = parse_video_filename("public/story-video/acorn_aa_scare.mp4")
        self.assertEqual(res, ("acorn", "aa", -2))

    def test_non_mp4_extension_rejected(self):
        res = parse_video_filename("public/story-video/doors_start_1.webm")
        self.assertIsNone(res)

    def test_invalid_names(self):
        self.assertIsNone(parse_video_filename("assets/game/story/luna_start.jpg"))
        self.assertIsNone(parse_video_filename("public/story-video/not_a_story_video.txt"))
        self.assertIsNone(parse_video_filename("public/story-video/invalid"))


class TestValidateCandidatePath(unittest.TestCase):
    def test_valid_candidate_path(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            cand = validate_candidate_path("candidates", "public/story-video/luna_start_0.mp4", root_dir=root)
            self.assertEqual(cand, (root / "candidates" / "public" / "story-video" / "luna_start_0.mp4").resolve())

    def test_reject_path_traversal(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with self.assertRaises(ValueError) as ctx:
                validate_candidate_path("candidates", "../../escaped.mp4", root_dir=root)
            self.assertIn("escapes candidates directory", str(ctx.exception))

    def test_reject_overwrite_shipped_asset(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with self.assertRaises(ValueError) as ctx:
                validate_candidate_path(".", "public/story-video/luna_start_0.mp4", root_dir=root)
            self.assertIn("cannot overwrite shipped asset", str(ctx.exception))

    def test_reject_empty_inputs(self):
        with self.assertRaises(ValueError):
            validate_candidate_path("", "public/story-video/luna_start_0.mp4")
        with self.assertRaises(ValueError):
            validate_candidate_path("candidates", "")


class TestReadQueue(unittest.TestCase):
    def test_read_dict_with_jobs(self):
        with tempfile.TemporaryDirectory() as td:
            qfile = Path(td) / "queue.json"
            qfile.write_text(
                json.dumps({
                    "jobs": [
                        {
                            "asset": "public/story-video/deep_start_0.mp4",
                            "mediaKind": "video",
                            "generator": "tools/gen_story_videos.py",
                            "model": DEFAULT_MODEL,
                        }
                    ],
                    "unmatched": [],
                }),
                encoding="utf-8",
            )
            jobs = read_queue(qfile)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0]["asset"], "public/story-video/deep_start_0.mp4")
            self.assertEqual(jobs[0]["model"], DEFAULT_MODEL)

    def test_read_filters_non_video_jobs(self):
        with tempfile.TemporaryDirectory() as td:
            qfile = Path(td) / "queue.json"
            qfile.write_text(
                json.dumps({
                    "jobs": [
                        {"asset": "assets/game/story/acorn_a.jpg", "mediaKind": "image"},
                        {"asset": "public/story-video/luna_start_0.mp4", "mediaKind": "video"},
                        {"asset": "public/audio/sfx.mp3", "mediaKind": "audio"},
                    ],
                    "unmatched": ["unknown.mp4"],
                }),
                encoding="utf-8",
            )
            jobs = read_queue(qfile)
            self.assertEqual(len(jobs), 1)
            self.assertEqual(jobs[0]["asset"], "public/story-video/luna_start_0.mp4")

    def test_read_queue_rejects_non_dict_job_item(self):
        with tempfile.TemporaryDirectory() as td:
            qfile = Path(td) / "queue.json"
            qfile.write_text(
                json.dumps({"jobs": ["not-a-dict"]}),
                encoding="utf-8",
            )
            with self.assertRaises(ValueError):
                read_queue(qfile)

    def test_read_queue_rejects_raw_list(self):
        with tempfile.TemporaryDirectory() as td:
            qfile = Path(td) / "queue.json"
            qfile.write_text(
                json.dumps([{"asset": "public/story-video/luna_start_0.mp4", "mediaKind": "video"}]),
                encoding="utf-8",
            )
            with self.assertRaises(ValueError):
                read_queue(qfile)

    def test_read_queue_missing_file_raises_error(self):
        with self.assertRaises(FileNotFoundError):
            read_queue("/nonexistent/file/path.json")


class TestBuildVideoPrompt(unittest.TestCase):
    def test_choice_prompt(self):
        prompt = build_video_prompt("luna", "start", 0)
        self.assertIn("Luna", prompt)
        self.assertIn("FULLY PERFORMS this action", prompt)
        self.assertIn("Trot to the forest", prompt)
        self.assertIn("green forest trees", prompt)

    def test_ending_prompt(self):
        prompt = build_video_prompt("luna", "end_party", -1)
        self.assertIn("Luna", prompt)
        self.assertIn("Animate this exact final storybook scene coming alive", prompt)
        self.assertIn("joyful, gentle", prompt)
        self.assertIn("acorn party", prompt)

    def test_scare_prompt(self):
        prompt = build_video_prompt("whisper", "start", -2)
        self.assertIn("Milo", prompt)
        self.assertIn("COMIC SURPRISE: a startled crow bursting upward", prompt)
        self.assertIn("gnarled bush beside the gate", prompt)

    def test_globe_replacements(self):
        prompt = build_video_prompt("globe", "start", 0)
        self.assertIn("archway", prompt)

    def test_unknown_story_id_raises_key_error(self):
        with self.assertRaises(KeyError):
            build_video_prompt("unknown_story_id", "start", 0)

    def test_out_of_bounds_choice_index_raises_index_error(self):
        with self.assertRaises(IndexError):
            build_video_prompt("luna", "start", 99)


class TestFindSceneImage(unittest.TestCase):
    def test_find_existing_scene_image(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            img_dir = root / "assets" / "game" / "story"
            img_dir.mkdir(parents=True)
            img_path = img_dir / "luna_start.png"
            img_path.write_bytes(b"\x89PNG\r\n\x1a\nfake-png-bytes")

            data, mime = find_scene_image("luna", "start", root_dir=root)
            self.assertEqual(data, b"\x89PNG\r\n\x1a\nfake-png-bytes")
            self.assertEqual(mime, "image/png")

    def test_find_existing_jpg_scene_image(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            img_dir = root / "assets" / "game" / "story"
            img_dir.mkdir(parents=True)
            img_path = img_dir / "acorn_aa.jpg"
            img_path.write_bytes(b"\xff\xd8\xfffake-jpg-bytes")

            data, mime = find_scene_image("acorn", "aa", root_dir=root)
            self.assertEqual(data, b"\xff\xd8\xfffake-jpg-bytes")
            self.assertEqual(mime, "image/jpeg")

    def test_missing_scene_image(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with self.assertRaises(FileNotFoundError):
                find_scene_image("nonexistent", "node", root_dir=root)


class TestCallVeo(unittest.TestCase):
    def test_call_veo_models_generate_videos(self):
        client = FakeVeoClient()
        data = call_veo(client, "veo-3.1-fast-generate-001", "A prompt", b"img-data", "image/png")
        self.assertEqual(data, client.video_bytes)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["model"], "veo-3.1-fast-generate-001")
        self.assertEqual(client.calls[0]["prompt"], "A prompt")
        img = client.calls[0]["image"]
        img_bytes = getattr(img, "image_bytes", None) or img.get("image_bytes")
        mime = getattr(img, "mime_type", None) or img.get("mime_type")
        self.assertEqual(img_bytes, b"img-data")
        self.assertEqual(mime, "image/png")

    def test_call_veo_missing_done_raises_attribute_error(self):
        client = MagicMock()
        client.models.generate_videos.return_value = object()
        with self.assertRaises(AttributeError):
            call_veo(client, "veo-3.1-fast-generate-001", "A prompt", b"img-data", "image/png")


class TestLoadSpecsAndHeroes(unittest.TestCase):
    def test_load_specs_fails_loudly_on_corrupt_json(self):
        with tempfile.TemporaryDirectory() as td:
            temp_tools = Path(td) / "tools"
            specs_dir = temp_tools / "gen" / "specs_wave2"
            specs_dir.mkdir(parents=True)
            (specs_dir / "bad.json").write_text("{corrupt json content", encoding="utf-8")
            with self.assertRaises(json.JSONDecodeError):
                load_specs_and_heroes(temp_tools)


class TestRunVideoCandidates(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.root = Path(self.td.name)
        # Create mock scene image
        img_dir = self.root / "assets" / "game" / "story"
        img_dir.mkdir(parents=True)
        (img_dir / "luna_start.png").write_bytes(b"\x89PNG\r\n\x1a\nscene-first-frame")
        (img_dir / "acorn_aa.jpg").write_bytes(b"\xff\xd8\xffacorn-scare-frame")

        # Shipped files exist
        shipped_dir = self.root / "public" / "story-video"
        shipped_dir.mkdir(parents=True)
        self.shipped_luna = shipped_dir / "luna_start_0.mp4"
        self.shipped_luna.write_bytes(b"original-shipped-luna-mp4")

        # Mock Veo client
        self.client = FakeVeoClient(video_bytes=b"newly-generated-mp4-data")
        import gen.gen_video_candidates as gvc
        self._orig_get_client = gvc.get_default_veo_client
        gvc.get_default_veo_client = lambda: self.client

    def tearDown(self):
        import gen.gen_video_candidates as gvc
        gvc.get_default_veo_client = self._orig_get_client
        self.td.cleanup()

    def test_successful_candidate_generation_without_touching_shipped_files(self):
        qfile = self.root / "queue.json"
        qfile.write_text(
            json.dumps({
                "jobs": [
                    {
                        "asset": "public/story-video/luna_start_0.mp4",
                        "mediaKind": "video",
                        "model": "veo-3.1-fast-generate-001",
                    }
                ]
            }),
            encoding="utf-8",
        )

        manifest = run_video_candidates(
            queue=qfile,
            candidates_dir="candidates",
            root_dir=self.root,
            write_manifest=True,
        )

        # Fake client was called with conditioning
        self.assertEqual(len(self.client.calls), 1)
        call = self.client.calls[0]
        self.assertEqual(call["model"], "veo-3.1-fast-generate-001")
        img = call["image"]
        img_bytes = getattr(img, "image_bytes", None) or img.get("image_bytes")
        mime = getattr(img, "mime_type", None) or img.get("mime_type")
        self.assertEqual(img_bytes, b"\x89PNG\r\n\x1a\nscene-first-frame")
        self.assertEqual(mime, "image/png")
        self.assertIn("Luna", call["prompt"])

        # Candidate MP4 was written to candidates/
        candidate_file = self.root / "candidates" / "public" / "story-video" / "luna_start_0.mp4"
        self.assertTrue(candidate_file.exists())
        self.assertEqual(candidate_file.read_bytes(), b"newly-generated-mp4-data")

        # Shipped file remains UNTOUCHED
        self.assertEqual(self.shipped_luna.read_bytes(), b"original-shipped-luna-mp4")

        # Manifest entries
        self.assertEqual(len(manifest), 1)
        self.assertEqual(manifest[0]["status"], "success")
        self.assertEqual(manifest[0]["assetPath"], "public/story-video/luna_start_0.mp4")
        self.assertEqual(
            manifest[0]["candidatePath"], "candidates/public/story-video/luna_start_0.mp4"
        )

        # candidates.json was written
        manifest_path = self.root / "candidates" / "candidates.json"
        self.assertTrue(manifest_path.exists())
        written_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(written_manifest[0]["status"], "success")

    def test_missing_scene_records_error_and_does_not_call_client(self):
        qfile = self.root / "queue.json"
        qfile.write_text(
            json.dumps({
                "jobs": [
                    {
                        "asset": "public/story-video/doors_start_0.mp4",
                        "mediaKind": "video",
                    }
                ]
            }),
            encoding="utf-8",
        )

        manifest = run_video_candidates(
            queue=qfile, candidates_dir="candidates", root_dir=self.root
        )
        self.assertEqual(len(self.client.calls), 0)
        self.assertEqual(len(manifest), 1)
        self.assertEqual(manifest[0]["status"], "error")
        self.assertIn("Failed to find scene image", manifest[0]["reason"])

    def test_client_error_records_failure_and_proceeds_to_next_job(self):
        self.client.fail_on.add("Luna")

        qfile = self.root / "queue.json"
        qfile.write_text(
            json.dumps({
                "jobs": [
                    {
                        "asset": "public/story-video/luna_start_0.mp4",
                        "mediaKind": "video",
                    },
                    {
                        "asset": "public/story-video/acorn_aa_scare.mp4",
                        "mediaKind": "video",
                    },
                ]
            }),
            encoding="utf-8",
        )

        manifest = run_video_candidates(
            queue=qfile, candidates_dir="candidates", root_dir=self.root
        )
        self.assertEqual(len(manifest), 2)
        self.assertEqual(manifest[0]["status"], "error")
        self.assertIn("Model generation failed", manifest[0]["reason"])
        self.assertEqual(manifest[1]["status"], "success")

        # Second candidate exists, first does not
        cand2 = self.root / "candidates" / "public" / "story-video" / "acorn_aa_scare.mp4"
        self.assertTrue(cand2.exists())


class TestCliMain(unittest.TestCase):
    def test_cli_main_success(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            img_dir = root / "assets" / "game" / "story"
            img_dir.mkdir(parents=True)
            (img_dir / "luna_start.png").write_bytes(b"\x89PNGscene")

            queue_file = root / "test_queue.json"
            queue_file.write_text(
                json.dumps({
                    "jobs": [{"asset": "public/story-video/luna_start_0.mp4", "mediaKind": "video"}]
                }),
                encoding="utf-8",
            )

            # Patch get_default_veo_client to return FakeVeoClient
            fake_client = FakeVeoClient()
            import gen.gen_video_candidates as gvc

            orig_get = gvc.get_default_veo_client
            gvc.get_default_veo_client = lambda: fake_client
            try:
                import io
                from unittest.mock import patch
                with patch("sys.stdout", new_callable=io.StringIO):
                    code = main([
                        str(queue_file),
                        "--root-dir",
                        str(root),
                        "--candidates-dir",
                        "candidates",
                    ])
                self.assertEqual(code, 0)
                cand = root / "candidates" / "public" / "story-video" / "luna_start_0.mp4"
                self.assertTrue(cand.exists())
            finally:
                gvc.get_default_veo_client = orig_get

    def test_cli_main_no_queue_exits_with_error(self):
        import io
        from unittest.mock import patch
        with patch("sys.stdout", new_callable=io.StringIO), patch("sys.stderr", new_callable=io.StringIO):
            code = main(["--root-dir", "/nonexistent"])
        self.assertEqual(code, 1)


if __name__ == "__main__":
    unittest.main()
