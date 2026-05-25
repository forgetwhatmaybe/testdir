import unittest
from unittest.mock import Mock

from api_clients.text_vision import TextVisionClient


class _FakeResponse:
    status_code = 200

    @staticmethod
    def json() -> dict:
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "ok"},
                        ]
                    }
                }
            ]
        }


class TextVisionClientTests(unittest.TestCase):
    def test_gemini_request_puts_thinking_level_in_body(self) -> None:
        client = TextVisionClient("test-key", "https://example.com")
        post = Mock(return_value=_FakeResponse())
        client._session = Mock(post=post)

        result = client.generate_text(
            "describe",
            image_paths=[],
            model="gemini-3.1-pro-preview",
            temperature=0.3,
            thinking_mode="high",
            format_mode="无",
        )

        self.assertEqual(result, "ok")
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["json"]["thinking-level"], "high")
        self.assertNotIn("thinking-level", kwargs["headers"])


if __name__ == "__main__":
    unittest.main()