"""Offline regressions for cache identity and timestamp evidence validation."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("groq_gita", Path(__file__).with_name("groq-gita-timings.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EvidenceTests(unittest.TestCase):
    def test_changed_inputs_invalidate_cache(self):
        baseline = module.fingerprint("audio-a", "text-a", "hi")[0]
        for inputs in [("audio-b", "text-a", "hi"), ("audio-a", "text-b", "hi"),
                       ("audio-a", "text-a", "sa")]:
            self.assertNotEqual(baseline, module.fingerprint(*inputs)[0])
        old_model = module.MODEL
        try:
            module.MODEL = "different-model"
            self.assertNotEqual(baseline, module.fingerprint("audio-a", "text-a", "hi")[0])
        finally:
            module.MODEL = old_model

    def test_valid_measured_words(self):
        module.validate_response({"words": [{"word": "शान्तिं", "start": .2, "end": 1.4},
                                           {"word": "निर्वाणपरमां", "start": 1.6, "end": 3.2}]}, 4)

    def test_missing_words_do_not_become_success(self):
        for result in [{}, {"words": []}, {"words": None}, {"words": "bad"}]:
            with self.subTest(result=result), self.assertRaises(ValueError):
                module.validate_response(result, 4)

    def test_invalid_times_are_rejected(self):
        for start, end in [(-1, 2), (2, 1), (1, float("nan")), (1, float("inf")), (1, 5), ("1", 2)]:
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                module.validate_response({"words": [{"word": "न", "start": start, "end": end}]}, 4)

    def test_nonmonotonic_words_are_rejected(self):
        with self.assertRaises(ValueError):
            module.validate_response({"words": [{"word": "शान्तिं", "start": 2, "end": 3},
                                               {"word": "न", "start": 1, "end": 2}]}, 4)

    def test_empty_tokens_are_rejected(self):
        with self.assertRaises(ValueError):
            module.validate_response({"words": [{"word": " ", "start": 1, "end": 2}]}, 4)

    def test_provider_hallucinations_are_quarantined_not_retimed(self):
        measured = {"words": [{"word": "शान्तिं", "start": 2, "end": 3},
                              {"word": "अर्जुन", "start": 1, "end": 9},
                              {"word": "न", "start": 3, "end": 3.2}]}
        result, rejected = module.usable_response(measured, 4)
        self.assertEqual(result["words"], [measured["words"][0], measured["words"][2]])
        self.assertEqual(rejected[0]["word"], measured["words"][1])
        self.assertEqual(len(measured["words"]), 3)


if __name__ == "__main__":
    unittest.main()
