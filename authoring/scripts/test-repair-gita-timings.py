"""Offline regression cases for split/merged Sanskrit and absent evidence."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('repair',Path(__file__).with_name('repair-gita-timings.py'))
repair=importlib.util.module_from_spec(spec);spec.loader.exec_module(repair)


def line_for(tokens):
    reference='';offsets=[]
    for token in tokens:
        start=len(reference);reference+=repair.normalize(token);offsets.append((start,len(reference)))
    return reference,{'tokens':tokens,'offsets':offsets,'verse':1}


class CanonicalMappingTests(unittest.TestCase):
    def test_spoken_visarga_retains_measured_word(self):
        self.assertTrue(repair.measured_match(['मतः'],repair.normalize('मतहा।'),'groq',748.1935,749.0335))
        self.assertFalse(repair.measured_match(['मत'],repair.normalize('मतहा।'),'groq',1,2))

    def test_merged_recognition_stays_one_acoustic_group(self):
        ref,line=line_for(['कर्म','करोति','यः'])
        heard=[{'word':'कर्मकरोतियः','start':2,'end':5}]
        support=repair.line_support(line,repair.match_characters(ref,heard),heard)
        self.assertEqual(repair.groups_for(line,support),[{'tokens':[0,1,2],'ids':{0}}])
        self.assertEqual((support['start'],support['end']),(2,5))

    def test_split_recognition_maps_to_canonical_compound(self):
        ref,line=line_for(['निर्वाणपरमां'])
        heard=[{'word':'निर्वाण','start':2,'end':3},{'word':'परमां','start':3,'end':4}]
        support=repair.line_support(line,repair.match_characters(ref,heard),heard)
        self.assertEqual(support['coverage'],1)
        self.assertEqual(repair.groups_for(line,support)[0]['ids'],{0,1})

    def test_missing_line_has_no_invented_bounds(self):
        ref,line=line_for(['आत्मसंस्थं','मनः'])
        support=repair.line_support(line,repair.match_characters(ref,[]),[])
        self.assertEqual(support['coverage'],0)
        self.assertNotIn('start',support)
        self.assertNotIn('end',support)

    def test_intro_is_not_assigned_to_speaker(self):
        ref,line=line_for(['श्रीभगवानुवाच'])
        heard=[{'word':'श्रीपरमात्मने','start':5,'end':8},
               {'word':'श्रीमद्भगवद्गीता','start':8,'end':12},
               {'word':'श्रीभगवानुवाच','start':16,'end':20}]
        support=repair.line_support(line,repair.match_characters(ref,heard),heard)
        self.assertEqual((support['start'],support['end']),(16,20))


if __name__=='__main__':unittest.main()
