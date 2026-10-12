"""Offline regressions for neighboring context, provenance and fallback cues."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('context', Path(__file__).with_name('repair-gita-context.py'))
context = importlib.util.module_from_spec(spec)
spec.loader.exec_module(context)


class ContextTests(unittest.TestCase):
    def test_promotion_refuses_changed_javascript_before_writing_live_files(self):
        work = Path(__file__).resolve().parents[2] / '.gita-work/tests'
        work.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=work) as directory:
            root = Path(directory)
            self.assertTrue(root.resolve().is_relative_to(work.resolve()))
            live = root / 'gita/1'
            candidate = root / '.gita-work/chapter-1/context-repair'
            live.mkdir(parents=True)
            candidate.mkdir(parents=True)
            (live / 'timings.json').write_text('original', encoding='utf-8')
            manifest = {'alignmentFingerprint': 'candidate', 'verses': []}
            context.write_json(candidate / 'timings.json', manifest)
            (candidate / 'timings.js').write_text('window.GITA_CHAPTER_1_TIMINGS = {};', encoding='utf-8')
            context.write_json(candidate / 'report.json', {'errors': [], 'fingerprint': 'candidate',
                'priorManifestSha256': context.sha(live / 'timings.json')})
            audit = root / 'audit.json'
            context.write_json(audit, {'errors': [], 'media': [{'chapter': 1, 'verse': 1}],
                'chapters': [{'chapter': 1, 'manifestSha256': context.sha(candidate / 'timings.json')}]})
            with patch.object(context, 'ROOT', root), self.assertRaisesRegex(ValueError, 'JS differs'):
                context.promote([1], audit)
            self.assertEqual((live / 'timings.json').read_text(encoding='utf-8'), 'original')

    def test_cut_prefers_sustained_silence_over_an_isolated_energy_dip(self):
        try:
            import numpy as np
        except ImportError:
            self.skipTest('Run in the alignment environment for the waveform check')
        audio = np.ones(4 * 16000, dtype=np.float32)
        audio[int(1.1 * 16000):int(1.8 * 16000)] = .01
        audio[int(2.08 * 16000):int(2.1 * 16000)] = 0
        cut = context.quiet_cut(audio, 1, 2.3)
        self.assertTrue(1.3 < cut < 1.6, cut)

    def test_target_uses_neighboring_lines_without_changing_tokens(self):
        located = [{'verse': v, 'tokens': [f'token-{v}-{i}'], 'start': v * 10 + i, 'end': v * 10 + i + .8}
                   for v in (1, 2, 3) for i in (0, 1)]
        jobs = context.context_jobs([{}, {}, {}], located, 40)
        target = jobs[1]
        self.assertEqual(target['tokens'][target['offset']:target['offset']+target['count']], ['token-2-0', 'token-2-1'])
        self.assertLess(target['start'], 20)
        self.assertGreater(target['end'], 30)

    def test_zero_score_cannot_replace_an_existing_cue(self):
        prior = {'verse': 1, 'sourceStart': 10, 'words': [{'text': 'कर्म', 'start': 1, 'end': 2, 'score': .8}]}
        selected, reasons = context.choose_words(prior, [{'word': 'कर्म', 'start': 11, 'end': 11.02, 'score': 0}], {}, {})
        self.assertEqual((selected[0]['start'], selected[0]['end']), (11, 12))
        self.assertEqual(reasons, ['retained-prior'])

    def test_complete_compound_can_extend_beyond_the_old_clip(self):
        prior = {'verse': 68, 'sourceStart': 947.444, 'words': [
            {'text': 'मामेवैष्यत्यसंशयः', 'start': 10.29, 'end': 11.476, 'score': .399}]}
        revised = [{'word': 'मामेवैष्यत्यसंशयः', 'start': 958.288, 'end': 961.05, 'score': .76}]
        selected, _ = context.choose_words(prior, revised, {}, {})
        self.assertEqual(selected[0]['end'], 961.05)

    def test_a_zero_duration_prior_cue_cannot_win_by_score(self):
        prior = {'verse': 10, 'sourceStart': 100, 'words': [
            {'text': 'रजः', 'start': 5.026, 'end': 5.026, 'score': .612}]}
        selected, reasons = context.choose_words(prior, [
            {'word': 'रजः', 'start': 104.9, 'end': 105.2, 'score': .3}], {}, {})
        self.assertGreater(selected[0]['end'], selected[0]['start'])
        self.assertEqual(reasons, ['neighbor-context-acoustic'])

    def test_a_short_boundary_word_can_drop_a_prior_pause(self):
        prior = [{'word': 'सत्त्वं', 'start': 127.367, 'end': 129.774, 'score': .67}]
        revised = [{'word': 'सत्त्वं', 'start': 129.084, 'end': 129.764, 'score': .42}]
        self.assertEqual(context.repair.reconciliation_issues(prior, revised), [])

    def test_conflicting_partial_alignment_keeps_an_ordered_prior_sequence(self):
        prior = {'verse': 1, 'sourceStart': 10, 'words': [
            {'text': 'कर्म', 'start': 1, 'end': 2, 'score': .8},
            {'text': 'च', 'start': 2.1, 'end': 2.3, 'score': 0}]}
        selected, reasons = context.choose_words(prior, [
            {'word': 'कर्म', 'start': 11.9, 'end': 12.5, 'score': .8},
            {'word': 'च', 'start': 12.6, 'end': 12.7, 'score': 0}], {}, {})
        self.assertLessEqual(selected[0]['end'], selected[1]['start'])
        self.assertEqual(reasons, ['retained-prior-context-conflict'] * 2)

    def test_changed_recording_or_window_invalidates_context_cache(self):
        a = {'source': 'a', 'start': 10, 'end': 20}
        self.assertNotEqual(context.fingerprint(a), context.fingerprint({**a, 'source': 'b'}))
        self.assertNotEqual(context.fingerprint(a), context.fingerprint({**a, 'end': 21}))

    def test_established_endpoint_is_preserved(self):
        prior = {'verse': 1, 'sourceStart': 10, 'words': [{'text': 'कर्म', 'start': 1, 'end': 2, 'score': .8}]}
        selected, _ = context.choose_words(prior, [{'word': 'कर्म', 'start': 11, 'end': 12.2, 'score': .9}], {},
                                            {'_lastCueEndOverrides': {'1': 12.4}})
        self.assertEqual(selected[0]['end'], 12.4)
        self.assertNotIn('score', selected[0])


if __name__ == '__main__':
    unittest.main()
