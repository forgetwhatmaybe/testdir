import tempfile
import unittest
from pathlib import Path

from services.task_queue import TaskQueue


class TaskQueueContractTests(unittest.TestCase):
    def _temp_media(self, suffix: str, content: bytes = b"test-bytes") -> str:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        self.addCleanup(lambda: Path(tmp.name).unlink(missing_ok=True))
        tmp.write(content)
        tmp.close()
        return tmp.name

    def test_normalizes_legacy_generation_modes(self) -> None:
        self.assertEqual(
            TaskQueue._normalized_generation_mode({"generation_mode": "image_to_video"}, default="reference"),
            "image2video",
        )
        self.assertEqual(
            TaskQueue._normalized_generation_mode({"generation_mode": "first_last_frame"}, default="reference"),
            "first_last",
        )
        self.assertEqual(
            TaskQueue._normalized_generation_mode({"generation_mode": "multimodal"}, default="reference"),
            "reference",
        )

    def test_seedance_image2video_uses_single_image_input_as_data_url(self) -> None:
        image_path = self._temp_media(".png")

        payload = TaskQueue._seedance_media_payload(
            {"mode": "image2video"},
            {"in_image": [image_path]},
        )

        self.assertEqual(len(payload["image_urls"]), 1)
        self.assertTrue(payload["image_urls"][0].startswith("data:image/png;base64,"))
        self.assertIsNone(payload["video_urls"])
        self.assertIsNone(payload["audio_urls"])

    def test_seedance_first_last_supports_legacy_mode_and_both_handles(self) -> None:
        first_path = self._temp_media(".jpg")
        last_path = self._temp_media(".jpg")

        payload = TaskQueue._seedance_media_payload(
            {"generation_mode": "first_last_frame"},
            {"in_first": [first_path], "in_last": [last_path]},
        )

        self.assertEqual(len(payload["image_urls"]), 2)
        self.assertTrue(payload["image_urls"][0].startswith("data:image/jpeg;base64,"))
        self.assertTrue(payload["image_urls"][1].startswith("data:image/jpeg;base64,"))

    def test_coerces_legacy_yes_no_strings_to_bool(self) -> None:
        self.assertTrue(TaskQueue._coerce_bool(True, default=False))
        self.assertTrue(TaskQueue._coerce_bool("是", default=False))
        self.assertFalse(TaskQueue._coerce_bool("否", default=True))
        self.assertFalse(TaskQueue._coerce_bool("false", default=True))

    def test_gemini_default_model_matches_frontend_first_option(self) -> None:
        self.assertEqual(
            TaskQueue._resolve_gemini_model({}),
            "gemini-3.1-flash-image-preview",
        )
        self.assertEqual(
            TaskQueue._resolve_gemini_model({"model": "gemini-2.5-flash-preview-image-generation"}),
            "gemini-2.5-flash-preview-image-generation",
        )

    def test_output_name_appends_batch_suffix_when_needed(self) -> None:
        node = {"id": "output_1", "data": {"name": "主输出"}}

        self.assertEqual(
            TaskQueue._resolve_output_name(node, {"output_suffix": ""}),
            "主输出",
        )
        self.assertEqual(
            TaskQueue._resolve_output_name(node, {"output_suffix": "_2"}),
            "主输出_2",
        )


if __name__ == "__main__":
    unittest.main()