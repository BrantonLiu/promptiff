"""Reproducible offline analysis. No article text is sent to an inference API."""
from pathlib import Path
import json, re, hashlib, difflib, math
from collections import Counter
import jieba
import numpy as np
from sentence_transformers import SentenceTransformer

ROOT=Path(__file__).resolve().parent.parent
MODEL='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
REVISION='e8f8c211226b894fcb81acc59f3b34ba3efd5f42'

def split_sentences(text):
    # Preserve all characters; sentence/long-clause units avoid model truncation.
    result=[]
    for sentence in re.findall(r'[^。！？；\n]+[。！？；\n]*|[。！？；\n]+', text):
        if len(sentence)<=100:
            result.append(sentence)
        else:
            carry=''
            for part in re.findall(r'[^，,]+[，,]*|[，,]+',sentence):
                if len(carry)+len(part)>100 and carry:
                    result.append(carry); carry=''
                while len(part)>100:
                    if carry: result.append(carry); carry=''
                    result.append(part[:100]);part=part[100:]
                carry+=part
            if carry: result.append(carry)
    assert ''.join(result)==text
    return result

def meaningful(t): return bool(re.search(r'[\w\u4e00-\u9fff]',t))
def char_count(t): return len(re.sub(r'\s','',t))
def build_doc(key):
    text=(ROOT/'content'/f'{key}.txt').read_text().strip()
    paragraphs=[]; sentences=[]
    for pidx,p in enumerate(text.split('\n\n')):
        ids=[]
        for s in split_sentences(p):
            sid=len(sentences); ids.append(sid)
            sentences.append(dict(id=sid,p=pidx,text=s,tokens=list(jieba.cut(s,HMM=True))))
        paragraphs.append(dict(text=p,sentences=ids))
    return dict(text=text,paragraphs=paragraphs,sentences=sentences,chars=char_count(text),sha256=hashlib.sha256(text.encode()).hexdigest())


def diff_ops(a,b):
    return [dict(type=tag,old=a[i:j],new=b[k:l],a=i,b=k) for tag,i,j,k,l in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes()]

def lexical_analysis(source,target):
    vocab=Counter(t for s in source for t in set(s['tokens']) if meaningful(t))
    idf=lambda t: math.log((len(source)+1)/(vocab.get(t,0)+1))+1
    def weighted_overlap(a,b):
        a=Counter(t for t in a if meaningful(t));b=Counter(t for t in b if meaningful(t))
        inter=sum(min(a[t],b[t])*idf(t) for t in a)
        den=sum(c*idf(t) for t,c in a.items())+sum(c*idf(t) for t,c in b.items())
        return 2*inter/den if den else 0
    def bigrams(s):return set(s[i:i+2] for i in range(len(s)-1))
    src_bi=[bigrams(s['text']) for s in source]
    for s in target:
        bi=bigrams(s['text']); scores=[]
        for i,orig in enumerate(source):
            dice=2*len(bi&src_bi[i])/max(1,len(bi)+len(src_bi[i]))
            scores.append(.65*weighted_overlap(s['tokens'],orig['tokens'])+.35*dice)
        idx=int(np.argmax(scores)); ref=source[idx]; orig=ref['tokens']; tgt=s['tokens']
        equal={}
        for match in difflib.SequenceMatcher(None,orig,tgt,autojunk=False).get_matching_blocks():
            for n in range(match.size): equal[match.b+n]=match.a+n
        words=[]
        for j,t in enumerate(tgt):
            if j in equal:
                score=1.0
            elif t in orig:
                positions=[i for i,v in enumerate(orig) if v==t]
                proximity=min(abs(i/max(1,len(orig))-j/max(1,len(tgt))) for i in positions)
                score=.65+.2*(1-proximity)
            else:
                sim=max((difflib.SequenceMatcher(None,t,x,autojunk=False).ratio() for x in orig if meaningful(x)),default=0)
                score=.05+.5*sim
            if not meaningful(t): score=None
            words.append(dict(text=t,score=round(score,4) if score is not None else None))
        # Punctuation takes the local field color, not a misleading 'exact word' match.
        for j,w in enumerate(words):
            if w['score'] is None:
                neighbors=[(abs(k-j),v['score']) for k,v in enumerate(words) if v['score'] is not None]
                w['score']=min(neighbors)[1] if neighbors else 1
        s['lexical']=dict(source=idx,score=round(scores[idx],4),words=words)


def main():
    docs={k:build_doc(k) for k in ['original','low','medium','high']}
    model=SentenceTransformer(MODEL,revision=REVISION,device='cpu')
    all_text=list(dict.fromkeys(s['text'] for d in docs.values() for s in d['sentences']))
    lengths=[len(model.tokenizer.encode(t)) for t in all_text]
    assert max(lengths)<=model.max_seq_length,(max(lengths),model.max_seq_length)
    matrix=model.encode(all_text,batch_size=24,normalize_embeddings=True,show_progress_bar=True)
    vectors={t:v for t,v in zip(all_text,matrix)}
    src=docs['original'];src_matrix=np.array([vectors[s['text']] for s in src['sentences']])
    summary={}
    for key,d in docs.items():
        lexical_analysis(src['sentences'],d['sentences'])
        mat=np.einsum('ik,jk->ij',np.array([vectors[s['text']] for s in d['sentences']],dtype=np.float64),src_matrix.astype(np.float64))
        assert np.isfinite(mat).all() and np.max(np.abs(mat)) < 1.0001
        for i,s in enumerate(d['sentences']):
            candidates=np.argsort(-mat[i],kind='stable')[:3]
            s['semantic']=dict(source=int(candidates[0]),score=round(float(np.clip(mat[i,candidates[0]],-1,1)),5),candidates=[dict(source=int(j),score=round(float(np.clip(mat[i,j],-1,1)),5)) for j in candidates],tokenCount=len(model.tokenizer.encode(s['text'])))
        d['review']=diff_ops(src['text'],d['text'])
        original_lines=[s['text'] for s in src['sentences']];new_lines=[s['text'] for s in d['sentences']]
        d['lineDiff']=[]
        for tag,i,j,k,l in difflib.SequenceMatcher(None,original_lines,new_lines,autojunk=False).get_opcodes():
            d['lineDiff'].append(dict(type=tag,oldStart=i,newStart=k,old=original_lines[i:j],new=new_lines[k:l]))
        d['diffRows']=[]
        for group in d['lineDiff']:
            for offset in range(max(len(group['old']),len(group['new']))):
                old=group['old'][offset] if offset<len(group['old']) else ''
                new=group['new'][offset] if offset<len(group['new']) else ''
                d['diffRows'].append(dict(type=group['type'],old=old,new=new,oldNumber=group['oldStart']+offset+1 if old else None,newNumber=group['newStart']+offset+1 if new else None,parts=diff_ops(old,new)))
        unchanged=sum(char_count(op['new']) for op in d['review'] if op['type']=='equal')
        deleted=sum(char_count(op['old']) for op in d['review'] if op['type']!='equal')
        added=sum(char_count(op['new']) for op in d['review'] if op['type']!='equal')
        d['stats']=dict(unchanged=unchanged,deleted=deleted,added=added,retention=round(unchanged/max(1,d['chars']),4),semanticMean=round(float(np.average(mat.max(axis=1),weights=[char_count(s['text']) or 1 for s in d['sentences']])),4),sourceCoverage=round(float(np.mean(mat.max(axis=0)>=.75)),4),lowSemantic=sum(s['semantic']['score']<.6 for s in d['sentences']))
        summary[key]=dict(chars=d['chars'],sentences=len(d['sentences']),**d['stats'])
    out=dict(meta=dict(model=MODEL,revision=getattr(model[0].auto_model.config,'_commit_hash',None),dimensions=int(matrix.shape[1]),maxTokens=max(lengths),jieba=jieba.__version__,semantic='Normalized sentence embeddings; cosine nearest-neighbor over all original units. Heat range 0.45–0.95. Scores are similarity, not authorship probabilities.',lexical='Jieba accurate mode/HMM. Best source unit: 0.65 IDF-weighted token Dice + 0.35 character-bigram Dice. LCS tokens 1; reordered exact token 0.65–0.85; novel token 0.05 + 0.5 character similarity. Punctuation inherits nearest word.',segmentation='Split at 。！？； and line breaks. Units over 100 characters split at commas, then hard limit at 100. Concatenation is lossless; assert no tokenizer truncation.',review='Python difflib SequenceMatcher with autojunk=False, whole-document character operations. Replacement = deletion + yellow insertion.',generated='2026-09-10',inference='local CPU; cached results shipped with demo'),documents=docs)
    dest=ROOT/'public/data';dest.mkdir(parents=True,exist_ok=True)
    (dest/'analysis.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
    names={'original':'原始口述','low':'低度改写','medium':'中度改写','high':'高度改写'}
    for key,d in docs.items():
        (dest/f'{key}.txt').write_text(d['text']+'\n')
    (dest/'all-versions.md').write_text('\n\n---\n\n'.join(f'# {names[k]}\n\n{d["text"]}' for k,d in docs.items())+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    print('model revision',out['meta']['revision'],'max tokens',max(lengths),'size', (dest/'analysis.json').stat().st_size)

if __name__=='__main__':main()
