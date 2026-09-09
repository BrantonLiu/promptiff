"""Validate lossless comparison and score provenance in the shipped fixture."""
from pathlib import Path
import json,re,math,hashlib,unittest
ROOT=Path(__file__).resolve().parent.parent
DATA=json.loads((ROOT/'public/data/analysis.json').read_text())
DOCS=DATA['documents']; SOURCE=DOCS['original']
class FixtureTests(unittest.TestCase):
 def test_original_is_unchanged(self):
  self.assertEqual(SOURCE['text'],(ROOT/'content/original.txt').read_text().strip())
 def test_all_representations_are_lossless(self):
  for key,d in DOCS.items():
   with self.subTest(version=key):
    self.assertEqual(d['text'],(ROOT/'content'/f'{key}.txt').read_text().strip())
    self.assertEqual(d['sha256'],hashlib.sha256(d['text'].encode()).hexdigest())
    self.assertEqual('\n\n'.join(p['text'] for p in d['paragraphs']),d['text'])
    for p in d['paragraphs']:
     self.assertEqual(''.join(d['sentences'][i]['text'] for i in p['sentences']),p['text'])
    self.assertEqual(''.join(op['old'] for op in d['review']),SOURCE['text'])
    self.assertEqual(''.join(op['new'] for op in d['review']),d['text'])
    self.assertEqual(''.join(r['old'] for r in d['diffRows']),''.join(s['text'] for s in SOURCE['sentences']))
    self.assertEqual(''.join(r['new'] for r in d['diffRows']),''.join(s['text'] for s in d['sentences']))
    for r in d['diffRows']:
     for side in ['old','new']:self.assertEqual(''.join(x[side] for x in r['parts']),r[side])
 def test_scores_have_valid_sources(self):
  for d in DOCS.values():
   for s in d['sentences']:
    self.assertEqual(''.join(w['text'] for w in s['lexical']['words']),s['text'])
    for w in s['lexical']['words']:self.assertTrue(0<=w['score']<=1)
    for mode in ['lexical','semantic']:
     self.assertTrue(0<=s[mode]['source']<len(SOURCE['sentences']))
     self.assertTrue(math.isfinite(s[mode]['score']))
     self.assertTrue(-1<=s[mode]['score']<=1)
    self.assertLessEqual(s['semantic']['tokenCount'],128)
    top=s['semantic']['candidates']
    self.assertEqual(top[0]['source'],s['semantic']['source'])
    self.assertEqual(top[0]['score'],s['semantic']['score'])
    self.assertEqual(sorted([x['score'] for x in top],reverse=True),[x['score'] for x in top])
 def test_identity_and_counts(self):
  self.assertEqual(SOURCE['stats']['retention'],1)
  self.assertAlmostEqual(SOURCE['stats']['semanticMean'],1,places=4)
  for s in SOURCE['sentences']:
   self.assertAlmostEqual(s['semantic']['score'],1,places=4)
   self.assertTrue(all(w['score']==1 for w in s['lexical']['words']))
  for d in DOCS.values():
   self.assertEqual(d['chars'],len(re.sub(r'\s','',d['text'])))
   self.assertEqual(d['stats']['unchanged']+d['stats']['added'],d['chars'])
   self.assertEqual(d['stats']['unchanged']+d['stats']['deleted'],SOURCE['chars'])
 def test_versions_differ_and_missing_date_stays_explicit(self):
  self.assertGreater(DOCS['low']['stats']['retention'],.9)
  self.assertLess(DOCS['medium']['chars'],SOURCE['chars']*.8)
  self.assertLess(DOCS['high']['chars'],DOCS['medium']['chars'])
  for key in ['low','medium','high']:
   self.assertIn('1925 年 12 月 1 日',DOCS[key]['text'])
   self.assertIn('待核实',DOCS[key]['text'])
if __name__=='__main__':unittest.main(verbosity=2)
