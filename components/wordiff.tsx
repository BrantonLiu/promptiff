'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type UIEvent } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, Check, Download, FileText, GitCompareArrows, Grid2X2, Info, Link2, RotateCcw, ScanText, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import raw from '@/public/data/analysis.json';
import type { Analysis, Doc, Level, Mode, Op, Sentence } from '@/lib/types';

const data = raw as unknown as Analysis;
const modes: {id:Mode;icon:typeof FileText;label:string;hint:string}[] = [
 {id:'review',icon:FileText,label:'审阅模式',hint:'逐字标出修改、新增与删除'},
 {id:'diff',icon:GitCompareArrows,label:'逐句 Diff',hint:'将长段落拆成句子，再做逐行比较'},
 {id:'lexical',icon:Grid2X2,label:'分词热力图',hint:'字词相近，不一定意思相同'},
 {id:'semantic',icon:Sparkles,label:'语义热力图',hint:'换了说法，意思也可能仍然接近'},
];
const levels:Record<Level,{label:string;short:string;desc:string}> = {
 original:{label:'原文自对照',short:'原文',desc:'零差异校验：原文与自身比较，文字保留率应为 100%，语义相似度应为 1。'},
 low:{label:'低度改写',short:'微调',desc:'保留篇章顺序与口述节奏，修正病句、重复用词和少量不准确表述。'},
 medium:{label:'中度改写',short:'润色',desc:'压缩重复，整理叙事顺序，把阅读经历、账号定位和运营情况串起来。'},
 high:{label:'高度改写',short:'重写',desc:'从账号的目标开篇，大幅压缩和重组；保留主要经历与立场，改变表达重心。'},
};
const percent=(n:number)=>`${(n*100).toFixed(1)}%`;
const heatColor=(n:number,semantic=false)=>{
 const t=Math.max(0,Math.min(1,semantic?(n-.45)/.5:n));
 const a=[249,220,132],b=[182,212,240];
 return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
};
function DiffParts({ops,side}:{ops:Op[];side:'old'|'new'}){
 return <>{ops.map((op,i)=>{const txt=op[side];if(!txt)return null;return <span key={i} className={op.type==='equal'?'':side==='old'?'diff-word-delete':'diff-word-add'}>{txt}</span>})}</>;
}
function Review({doc,hideDeleted}:{doc:Doc;hideDeleted:boolean}){
 return <div className="review-text">{doc.review.map((op,i)=>op.type==='equal'?<span key={i}>{op.new}</span>:<span key={i} className="change-group">{!hideDeleted&&op.old&&<del title="删除的原文">{op.old}</del>}{op.new&&<ins className={op.type==='replace'?'replacement':'addition'} title={op.type==='replace'?'替换后的表达':'新增文字'}>{op.new}</ins>}</span>)}</div>;
}

export default function Wordiff({initialMode='lexical',initialLevel='medium'}:{initialMode?:Mode;initialLevel?:Level}){
 const [mode,setMode]=useState<Mode>(initialMode);
 const [level,setLevel]=useState<Level>(initialLevel);
 const [sync,setSync]=useState(true);
 const [hideDeleted,setHideDeleted]=useState(false);
 const [onlyChanges,setOnlyChanges]=useState(false);
 const [methods,setMethods]=useState(false);
 const [highlightedSource,setHighlightedSource]=useState<number|null>(null);
 const [selected,setSelected]=useState<{sentence:number;word?:number}|null>(null);
 const [mobileSide,setMobileSide]=useState<'original'|'rewrite'>('rewrite');
 const [toast,setToast]=useState('');
 const left=useRef<HTMLDivElement>(null), right=useRef<HTMLDivElement>(null);
 const sourceRefs=useRef<Record<number,HTMLSpanElement|null>>({});
 const syncing=useRef(false);
 const current=data.documents[level], original=data.documents.original;
 const heat=mode==='lexical'||mode==='semantic';
 const active=modes.find(m=>m.id===mode)!;
 const selectedSentence=selected?current.sentences[selected.sentence]:null;
 const matchId=highlightedSource;
 const selectedSource=matchId!==null?original.sentences[matchId]:null;
 const jumpTargets=current.sentences.filter(s=>mode==='semantic'?s.semantic.score<.65:s.lexical.score<.55);
 const [jumpIndex,setJumpIndex]=useState(-1);
 useEffect(()=>{
  function readLocation(){
   const path=window.location.pathname.slice(1);
   setMode(modes.some(m=>m.id===path)?path as Mode:initialMode);
   const l=new URLSearchParams(window.location.search).get('level');
   setLevel(l&&Object.hasOwn(levels,l)?l as Level:'medium');setSelected(null);
  }
  readLocation();window.addEventListener('popstate',readLocation);
  return ()=>window.removeEventListener('popstate',readLocation);
 },[initialMode]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2400);return()=>clearTimeout(t)},[toast]);
 function navigate(m:Mode,l:Level){setMode(m);setLevel(l);setSelected(null);setHighlightedSource(null);setJumpIndex(-1);window.history.pushState(null,'',`/${m}?level=${l}`);if(right.current)right.current.scrollTop=0;if(left.current)left.current.scrollTop=0;}
 function scrollTogether(e:UIEvent<HTMLDivElement>,side:'left'|'right'){
  if(!sync||syncing.current||selected)return;
  const other=side==='left'?right.current:left.current, el=e.currentTarget;
  if(other){syncing.current=true;other.scrollTop=(el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight))*(other.scrollHeight-other.clientHeight);requestAnimationFrame(()=>{syncing.current=false})}
 }
 function inspect(sid:number,word?:number){
  setSelected({sentence:sid,word});
  const s=current.sentences[sid];const id=mode==='semantic'?s.semantic.source:s.lexical.source;
  setHighlightedSource(id);
  const el=sourceRefs.current[id], panel=left.current;
  if(el&&panel){syncing.current=true;panel.scrollTo({top:el.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop-90,behavior:'smooth'});setTimeout(()=>{syncing.current=false},500)}
 }
 function nextDifference(){if(!jumpTargets.length)return;const i=(jumpIndex+1)%jumpTargets.length;setJumpIndex(i);const s=jumpTargets[i];inspect(s.id);document.getElementById(`target-${s.id}`)?.scrollIntoView({behavior:'smooth',block:'center'})}
 async function copyLink(){try{await navigator.clipboard.writeText(window.location.href);setToast('当前视图链接已复制')}catch{setToast('复制失败，请复制浏览器地址栏中的链接')}}
 function openOriginal(){setSelected(null);setMobileSide('original');requestAnimationFrame(()=>{const el=highlightedSource!==null?sourceRefs.current[highlightedSource]:null;const panel=left.current;if(el&&panel)panel.scrollTop=el.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop-90})}
 function renderSentence(s:Sentence){
  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Inline highlights must wrap across text lines; native buttons are atomic boxes.
  if(mode==='semantic')return <span key={s.id} id={`target-${s.id}`} role="button" tabIndex={0} className={`heat-unit ${selected?.sentence===s.id?'selected-unit':''}`} style={{background:heatColor(s.semantic.score,true)}} onClick={()=>inspect(s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(s.id)}}} title={`语义余弦 ${s.semantic.score.toFixed(3)} · 点击查看原句`}>{s.text}</span>;
  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Keyboard-enabled inline word highlights preserve natural text wrapping.
  return <span key={s.id} id={`target-${s.id}`} className={selected?.sentence===s.id?'selected-sentence':''}>{s.lexical.words.map((w,i)=><span role="button" tabIndex={0} key={i} className={`heat-unit word-unit ${selected?.sentence===s.id&&selected.word===i?'selected-unit':''}`} style={{background:heatColor(w.score)}} onClick={()=>inspect(s.id,i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(s.id,i)}}} title={`「${w.text}」字面保留分 ${w.score.toFixed(2)} · 点击查看依据`}>{w.text}</span>)}</span>;
 }
 return <main className="workspace">
  <header className="topbar"><Link className="brand" href="/"><span className="brandmark"><ScanText size={21}/></span>wordiff<span className="beta">LAB</span></Link><span className="top-caption">让改写有迹可循</span><Button variant="ghost" onClick={()=>setMethods(true)}><BookOpen/> 实验说明 <ArrowUpRight size={14}/></Button><a className="download-button" href="/data/all-versions.md" download><Download size={14}/><span>下载四篇文章</span></a></header>
  <section className="intro"><div><div className="eyebrow">EXPERIMENT 001 / 写作中的作者与 AI</div><h1>文字变了，意思呢？</h1><p>同一篇口述，三种改写程度。看看哪些表达被保留，哪些意思走远了。</p></div><fieldset className="level-picker" aria-label="改写程度"><span>改写程度</span>{(['low','medium','high'] as Level[]).map((l,i)=><Button key={l} variant="ghost" aria-pressed={level===l} className={level===l?'chosen':''} onClick={()=>navigate(mode,l)}>{['低','中','高'][i]}<small>{levels[l].short}</small></Button>)}</fieldset></section>
  <Tabs value={mode} onValueChange={v=>navigate(v as Mode,level)}>
   <div className="viewbar"><TabsList variant="line" aria-label="比较方式">{modes.map(({id,icon:Icon,label},i)=><TabsTrigger key={id} value={id} className={mode===id?'active':''}><Icon size={17}/>{label}<small>0{i+1}</small></TabsTrigger>)}</TabsList><span className="viewhint">{active.hint}</span></div>
   <div className="stats-strip" aria-live="polite"><div className="stat"><span>改写后字数</span><strong>{current.chars.toLocaleString()}</strong><small className="delta">{current.chars===original.chars?'与原文等长':`${((current.chars/original.chars-1)*100).toFixed(0)}%`}</small></div><div className="stat"><span>原样保留文字</span><strong>{percent(current.stats.retention)}</strong><span className="mini-bar"><i style={{width:percent(current.stats.retention)}}/></span></div><div className="stat"><span>平均语义相似度</span><strong>{current.stats.semanticMean.toFixed(3)}</strong><small>余弦值</small></div><Button variant="ghost" className="stats-info" size="icon-sm" aria-label="查看指标计算方式" onClick={()=>setMethods(true)}><Info size={15}/></Button></div>
   {modes.map(m=><TabsContent value={m.id} key={m.id} keepMounted={false}>
    <div className="legendbar">
     {heat?<div className="heat-legend"><span><i className="legend-dot blue"/>接近原文</span><div className="gradient-legend"/><span><i className="legend-dot yellow"/>差距较大</span><small>{mode==='semantic'?'句子级 · 真实 embedding':'词语级 · 结巴分词'}</small></div>:<div className="review-legend"><span><i className="legend-dot yellow"/>修改</span><span><i className="legend-dot bluegray"/>增加</span><span><i className="legend-dot red"/>删除</span><small>{mode==='diff'?'一句一行，长句按分句拆开':'显示全文字符差异'}</small></div>}
     <div className="reading-controls">{mode==='review'&&<label htmlFor={`hide-${m.id}`}><Switch id={`hide-${m.id}`} checked={hideDeleted} onCheckedChange={setHideDeleted} size="sm"/>隐藏删除</label>}{mode==='diff'?<label htmlFor={`only-${m.id}`}><Switch id={`only-${m.id}`} checked={onlyChanges} onCheckedChange={setOnlyChanges} size="sm"/>只看变化</label>:<label htmlFor={`sync-${m.id}`} title="按两栏滚动进度同步；点击色块后，原文按匹配位置定位"><Switch id={`sync-${m.id}`} checked={sync} onCheckedChange={setSync} size="sm"/>同步滚动</label>}<Button size="icon-sm" variant="ghost" onClick={copyLink} aria-label="复制当前视图链接"><Link2 size={14}/></Button></div>
    </div>
    {mode==='diff'?<section className="git-panel">
      <div className="git-file"><GitCompareArrows size={16}/><span>原始口述.txt <span className="arrow">→</span> {levels[level].label}.txt</span><span className="git-count"><b>+{current.stats.added}</b> <em>−{current.stats.deleted}</em> 字</span></div>
      <div className="git-column-head"><span>原文 · OLD</span><span>{levels[level].label} · NEW</span></div>
      <div className="git-scroll"><table className="diff-table"><tbody>{current.diffRows.map((row,i)=>onlyChanges&&row.type==='equal'?null:<tr key={i} className={row.type==='equal'?'equal-row':'changed-row'}><td className="line-number">{row.oldNumber}</td><td className={`diff-cell ${row.type!=='equal'&&row.old?'old-cell':''}`}><span className="diff-sign">{row.type==='equal'?' ':row.old?'−':''}</span><DiffParts ops={row.parts} side="old"/></td><td className="line-number">{row.newNumber}</td><td className={`diff-cell ${row.type!=='equal'&&row.new?'new-cell':''}`}><span className="diff-sign">{row.type==='equal'?' ':row.new?'+':''}</span><DiffParts ops={row.parts} side="new"/></td></tr>)}</tbody></table>{onlyChanges&&level==='original'&&<div className="empty-state"><Check/>原文与自身完全一致，没有变化。</div>}</div>
      <div className="panel-foot">按原文顺序对齐；替换块左右行仅按位置并排，不代表语义一一对应。段落重排也会记为删除与增加。</div>
     </section>:<>
      <div className="mobile-tabs"><Button variant="ghost" aria-pressed={mobileSide==='original'} onClick={()=>setMobileSide('original')}>作者原文</Button><Button variant="ghost" aria-pressed={mobileSide==='rewrite'} onClick={()=>setMobileSide('rewrite')}>{levels[level].label}</Button></div>
      <section className={`comparison mobile-${mobileSide}`}>
       {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll panel is focusable for keyboard scrolling. */}
       <article className="paper original-paper"><div className="paperbar"><span><i className="dot"/>作者原文 <small>ORIGINAL</small></span><small>{original.chars.toLocaleString()} 字 · 口述原稿</small></div><div ref={left} className="article-scroll" onScroll={e=>scrollTogether(e,'left')} tabIndex={0} aria-label="作者原文，可滚动"><div className="article-body"><div className="document-label">一位读者的自述 · 展示标题</div><h2>我为什么做这个《毛选》账号</h2><div className="byline">Branton · 2026 年 9 月 10 日 · 北京</div>{original.paragraphs.map((p,i)=><p key={i}><span className="paragraph-number">{String(i+1).padStart(2,'0')}</span>{p.sentences.map(id=><span key={id} ref={el=>{sourceRefs.current[id]=el}} className={matchId===id?'source-match':''}>{original.sentences[id].text}</span>)}</p>)}</div></div><div className="panel-foot"><span className="tiny-dot"/>原文完整保留，包括口述中的待核实信息</div></article>
       {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll panel is focusable for keyboard scrolling. */}
       <article className="paper rewrite-paper"><div className="paperbar"><span><i className="dot amber"/>{levels[level].label} <small>AI REWRITE</small></span><small>{current.chars.toLocaleString()} 字 · {current.sentences.length} 个句子 / 分句</small></div><div ref={right} className="article-scroll" onScroll={e=>scrollTogether(e,'right')} tabIndex={0} aria-label="改写文章，可滚动"><div className={`article-body ${heat?'heat':''}`}><div className="document-label">{level==='low'?'保留口述节奏':level==='medium'?'压缩重复 · 整理叙事':level==='high'?'改变开篇 · 大幅重组':'原文自对照'} · 展示标题</div><h2>{level==='high'?'把读者带到《毛选》原文附近':'我为什么做这个《毛选》账号'}</h2><div className="byline">{levels[level].desc}</div>{mode==='review'?<Review doc={current} hideDeleted={hideDeleted}/>:current.paragraphs.map((p,i)=><p key={i}><span className="paragraph-number">{String(i+1).padStart(2,'0')}</span>{p.sentences.map(id=>renderSentence(current.sentences[id]))}</p>)}</div></div><div className="panel-foot">{heat?<><span><Info size={12}/> 点击色块，追溯对应原句</span><Button variant="ghost" size="xs" disabled={!jumpTargets.length} onClick={nextDifference}>下一处明显变化 <ArrowDown size={12}/></Button></>:<span>−{current.stats.deleted} 字删除 · +{current.stats.added} 字增加（均含替换）</span>}</div></article>
      </section>
     </>}
   </TabsContent>)}
  </Tabs>
  <footer className="workspace-footer"><span><i className="tiny-dot"/>真实算法 · 全文比较 · 本地预计算</span><span>颜色表示相似程度，不能判定作者归属或事实真伪。</span><Button size="xs" variant="ghost" onClick={()=>setMethods(true)}>计算方式与编辑说明 <ArrowUpRight size={12}/></Button></footer>
  {selectedSentence&&selectedSource&&<aside className="inspector" aria-label="匹配依据"><div className="inspector-head"><span>{mode==='semantic'?<Sparkles size={15}/>:<Grid2X2 size={15}/>} {mode==='semantic'?'语义匹配依据':'分词匹配依据'}</span><Button variant="ghost" size="icon-sm" onClick={()=>setSelected(null)} aria-label="关闭匹配详情"><X size={15}/></Button></div><div className="inspector-body"><div className="match-score"><span>{mode==='semantic'?'句子余弦相似度':selected?.word!==undefined?`「${selectedSentence.lexical.words[selected.word].text}」字面保留分`:'句子字面匹配分'}</span><strong>{(mode==='semantic'?selectedSentence.semantic.score:selected?.word!==undefined?selectedSentence.lexical.words[selected.word].score:selectedSentence.lexical.score).toFixed(3)}</strong></div><small>改写片段</small><p>{selectedSentence.text}</p><small>最接近的原文 · 第 {selectedSource.p+1} 段 / 第 {selectedSource.id+1} 句</small><blockquote>{selectedSource.text}</blockquote>{mode==='semantic'?<><div className="candidate-list">{selectedSentence.semantic.candidates.map((c,i)=><div key={c.source}><span>候选 {i+1} · 原文第 {c.source+1} 句</span><b>{c.score.toFixed(3)}</b></div>)}</div><div className="inspector-note">模型 tokenizer：{selectedSentence.semantic.tokenCount} tokens · {data.meta.dimensions} 维向量。相似度高仍可能含有否定、数字或立场变化。</div></>:<div className="inspector-note">先找到字面最接近的原句，再对分词做序列匹配。原位保留得 1 分，移位复用与局部字形相似得较低分；不理解词义。</div>}<Button className="mobile-source-button" variant="outline" onClick={openOriginal}>查看对应原文 <ArrowUpRight size={13}/></Button></div></aside>}
  {toast&&<output className="toast">{toast}</output>}
  <Dialog open={methods} onOpenChange={setMethods}><DialogContent className="methods-dialog"><DialogHeader><div className="eyebrow">ABOUT THIS EXPERIMENT</div><DialogTitle>我们究竟在比较什么？</DialogTitle><DialogDescription>这是一组有明确原稿的改写对照，不是 AI 文本检测器。</DialogDescription></DialogHeader><div className="method-sections">
   <section><h3>01 / 四篇文章，三种改写幅度</h3><p>原稿为本次口述正文，保留措辞、标点及括号内的请求；仅去除文件首尾空白。低改写修句，中改写压缩，高改写重新组织开篇与论述重点。展示标题由 AI 添加，不参与正文统计。三份改写均由本次助手生成，切换时读取固定版本，不实时重新生成。</p><div className="version-table">{Object.entries(data.documents).map(([k,d])=><div key={k}><span>{levels[k as Level].label}</span><b>{d.chars} 字</b><span>{d.sentences.length} 个比较单元</span><a href={`/data/${k}.txt`} download>下载 <Download size={11}/></a></div>)}</div></section>
   <section><h3>02 / 字面算法</h3><p>审阅用字符序列差异，黄色是替换的新文字，灰蓝色是增加，红色删除线是原文被删的内容。隐藏删除后，右栏正文可完整还原改写稿。逐句 Diff 把句子作为行，长句再按逗号拆分；重排仍会表现为删除与增加。</p><p>分词使用 <a href="https://github.com/fxsjy/jieba" target="_blank" rel="noreferrer">结巴 {data.meta.jieba}</a> 精确模式。每句先用 IDF 加权词语重合（65%）和二字片段重合（35%）寻找原句，再按词序、复用位置及字形相似度给词语着色。相邻同分词语无缝连接成色带，标点继承附近词语的颜色。低频词影响句子检索，但颜色不是单纯词频。</p></section>
   <section><h3>03 / 真实语义向量</h3><p>使用 <a href={`https://huggingface.co/${data.meta.model}`} target="_blank" rel="noreferrer">{data.meta.model}</a>，通过模型自带 tokenizer 编码，做 mean pooling 和 L2 归一化，得到 {data.meta.dimensions} 维句子向量；逐句与全部原句计算余弦相似度，取最高值。允许跨段落匹配与多对一匹配。全部推理在本机完成，页面读取真实计算的缓存。</p><p>比较单元先按句末标点切分，超过 100 字按逗号继续切分，仍过长再定长切分；保留所有字符。最长输入为 {data.meta.maxTokens} tokens，没有截断。整句共用一个语义色块，不把句子分数伪装成每个词的独立语义判断。</p><div className="method-scale"><span>≤ 0.45 差距较大</span><div className="gradient-legend"/><span>≥ 0.95 接近原文</span></div><p>热力图使用固定色阶，三个版本共用标尺；中间按余弦值线性插色。低于 0.45 与高于 0.95 的颜色饱和，详情保留真实分数。模型版本：<code>{data.meta.revision}</code>。</p></section>
   <section><h3>04 / 三个指标的边界</h3><p>字数按非空白字符统计，包含标点和数字。原样保留文字 = 顺序对齐后未改字符数 ÷ 改写稿字符数；段落重排会降低这个数值。平均语义相似度按改写句子的字符数加权，是“改写 → 原文”的单向最近邻均值，不代表全文原意被保留的比例，也看不出所有删掉的观点。</p><p>当前版本里，原文比较单元在改写中能找到余弦 ≥ 0.75 匹配的比例为 <b>{percent(current.stats.sourceCoverage)}</b>。这同样只是参考：数字、否定、人物、承诺强度等细节需人工对读；相似度不等于真实、正确或作者认可。</p></section>
   <section><h3>05 / 事实补充与编辑判断</h3><ul><li><a href="https://www.dswxyjy.org.cn/GB/434461/434473/434979/index.html" target="_blank" rel="noreferrer">第一篇《中国社会各阶级的分析》首次发表：1925 年 12 月 1 日</a>。这是检索后补入的信息，三份改写都能在对照中看到。</li><li>账号第一篇《反对本本主义》的发布日期没有可核实记录，保留“待核实”；没有捏造日期。</li><li>“他第一次说出来”“同龄”“一切问题都归结到阶级”“阶级才是最主要的矛盾”等，改成较有限的陈述或作者个人理解；这些是编辑介入，可能改变断言强度，需作者确认。</li><li>60 篇、159 篇、30 天、播放量及捐款计划来自口述，没有外部核验。30%～50% 保留为个人阅读感受，不当作测量结果。</li></ul></section>
   <div className="method-actions"><Button variant="outline" onClick={()=>{navigate(mode,'original');setMethods(false)}}><RotateCcw size={14}/>原文自对照校验</Button><a href="/data/analysis.json" download>下载完整计算数据 <Download size={13}/></a></div>
  </div></DialogContent></Dialog>
 </main>;
}
