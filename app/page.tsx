/* oxlint-disable next/no-html-link-for-pages -- Native navigation avoids the reproduced vinext production Link crash. */
import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  GitCompareArrows,
  Grid2X2,
  ScanText,
  Sparkles,
} from 'lucide-react';
import type { Level } from '@/lib/types';

const features = [
  {
    id: 'review',
    icon: FileText,
    name: '审阅模式',
    unit: '字符级',
    title: '审阅模式',
    description: '在完整正文中标出删除、替换和新增的文字，结合上下文核对修改。',
    steps: [
      '将原文与改写稿作为两串字符，用 SequenceMatcher（关闭 autojunk）寻找连续匹配。',
      '把未匹配部分分为删除、增加与替换，在原文旁展示完整修订稿。',
    ],
    detail:
      '红色删除线表示删去的原文，黄色表示替换后的文字，灰蓝色表示纯增加。可隐藏删除内容，连贯阅读改写稿。',
    note: '适合逐字核对措辞；段落搬移也可能被记为删除与增加。',
  },
  {
    id: 'diff',
    icon: GitCompareArrows,
    name: '类 Git Diff 比对模式',
    unit: '句子 / 长分句',
    title: '类 Git Diff 比对模式',
    description:
      '原文在左，改写在右。把长段落拆成可以逐行检查的片段，再看每行内部的文字变化。',
    steps: [
      '按句末标点分句；超过 100 字先按逗号拆分，必要时按固定长度拆分，保留所有字符。',
      '对句子序列做 SequenceMatcher 匹配，替换块按位置并排，再标出块内字符差异。',
    ],
    detail:
      '左栏红色标记删除，右栏黄色标记增加或替换的文字。开启「只看变化」可跳过完全一致的行。',
    note: '左右行按位置排列，不代表语义一一对应。适合检查增删和结构变化。',
  },
  {
    id: 'lexical',
    icon: Grid2X2,
    name: '切词比对模式',
    unit: '词语级',
    title: '切词比对模式',
    description:
      '用颜色标出原样保留、移位复用和新出现的词，点击词语查看匹配依据。',
    steps: [
      '用 jieba 精确模式（HMM）切词，再按词语重合度（65%）和相邻二字片段重合度（35%），寻找字面最接近的原句。',
      '重合度用 Dice 分数表示，共有部分越多，分数越高：共有部分的量乘以 2，再除以两句各自总量之和。词语按 IDF 加权，原文中较少出现的词权重更高；二字片段按去重后的集合比较。',
      '对词序做匹配：顺序保留得 1 分，移位复用得 0.65–0.85 分；新词按 0.05 + 0.5 × 最佳字形相似度计分。',
    ],
    detail:
      '蓝色表示字面接近，黄色表示差距较大，色阶为 0–1。标点继承最近词的颜色；点击词语可查看匹配依据。',
    note: '衡量词语与位置的保留，不理解词义。适合观察改写力度。',
  },
  {
    id: 'semantic',
    icon: Sparkles,
    name: '按句语义比对模式',
    unit: '句子 / 长分句',
    title: '按句语义比对模式',
    description: '为每个改写句寻找意思最接近的原句，点击句子查看匹配结果。',
    steps: [
      '使用 paraphrase-multilingual-MiniLM-L12-v2，经 mean pooling 和 L2 归一化，生成 384 维句向量。',
      '每个改写句与全部原文句计算余弦相似度，取最高值着色，并保留前三个匹配候选。',
    ],
    detail:
      '蓝色表示语义接近，黄色表示差距较大。固定色阶为 0.45–0.95，区间外颜色饱和；整句共用一个分数。',
    note: '相似度可能低估否定、数字或立场变化，仍需对读原文确认。',
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const selected: Level = ['original', 'low', 'medium', 'high'].includes(
    level ?? '',
  )
    ? (level as Level)
    : 'medium';
  const startHref = `/review?level=${selected}`;
  return (
    <main className="landing">
      <a className="landing-skip" href="#features">
        跳到功能介绍
      </a>
      <header className="landing-header landing-container">
        <a className="brand" href="/" aria-label="版本比对器首页">
          <span className="brandmark">
            <ScanText size={21} />
          </span>
          版本比对器<span className="beta">LAB</span>
        </a>
        <nav aria-label="首页导航">
          <a className="landing-nav-link" href="/canvas">
            Agent 画布
          </a>
          <a className="landing-nav-link" href="#features">
            四种比对方式
          </a>
          <a className="landing-button compact" href={startHref}>
            查看比对示例 <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <section className="landing-hero landing-container">
        <div className="landing-hero-copy">
          <p className="landing-kicker">WORDIFF / AI 改写比对工具</p>
          <h1>
            受够了 AI 改写，
            <br />
            <span>不知道该看哪里？</span>
          </h1>
          <p className="landing-lead">
            逐字核对增删改，也可以切换类 Git Diff、切词或按句语义比对。
            <br />
            先用内置样本试试，看看哪种方式更适合你。
          </p>
          <div className="landing-actions">
            <a className="landing-button" href={startHref}>
              查看比对示例 <ArrowRight size={18} />
            </a>
            <a className="landing-text-link" href="#features">
              查看四种比对方式 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="landing-availability">
            无需登录 · 内置三种改写样本 · Agent 画布支持导入
          </p>
        </div>
        <figure className="landing-hero-figure">
          <div className="landing-preview-bar">
            <span>
              <Sparkles size={16} /> 按句语义比对模式
            </span>
            <span>原文 ↔ 中度改写</span>
          </div>
          <Image
            unoptimized
            src="/previews/semantic.png"
            width={1187}
            height={544}
            alt="实际语义比对正文：左侧为原文，右侧改写句以蓝黄渐变显示语义接近程度"
            fetchPriority="high"
          />
          <figcaption>
            <span>示例：原文与中度改写的语义比对</span>
            <span className="landing-color-key">
              接近原文 <i /> 差距较大
            </span>
          </figcaption>
        </figure>
      </section>
      <section
        id="features"
        className="landing-features landing-container"
        aria-labelledby="features-title"
      >
        <div className="landing-section-heading">
          <div>
            <p className="landing-kicker">功能介绍</p>
            <h2 id="features-title">选择适合你的比对方式</h2>
          </div>
          <p>
            以下均为当前中度改写的实际正文截图。
            <br />
            进入比对页面，可切换改写程度，点击句子或词语定位对应原文。
          </p>
        </div>
        <nav className="landing-feature-nav" aria-label="功能介绍目录">
          {features.map(({ id, icon: Icon, name }, i) => (
            <a key={id} href={`#${id}`}>
              <span>0{i + 1}</span>
              <Icon size={18} />
              {name}
            </a>
          ))}
        </nav>
        {features.map(
          (
            {
              id,
              icon: Icon,
              name,
              unit,
              title,
              description,
              steps,
              detail,
              note,
            },
            i,
          ) => (
            <section
              className="landing-feature"
              id={id}
              key={id}
              aria-labelledby={`${id}-title`}
            >
              <div className="landing-feature-copy">
                <div className="landing-feature-label">
                  <span>0{i + 1}</span>
                  <Icon size={18} />
                  {name}
                  <small>{unit}</small>
                </div>
                <h3 id={`${id}-title`}>{title}</h3>
                <p className="landing-feature-description">{description}</p>
                <h4>算法原理</h4>
                <ol>
                  {steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <h4>比对方式</h4>
                <p>{detail}</p>
                <p className="landing-feature-note">{note}</p>
                <a
                  className="landing-text-link"
                  href={`/${id}?level=${selected}`}
                >
                  使用{name} <ArrowRight size={16} />
                </a>
              </div>
              <figure className="landing-feature-figure">
                <div className="landing-preview-bar">
                  <span>作者原文</span>
                  <span>中度改写 · {name}</span>
                </div>
                <a
                  href={`/previews/${id}.png`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`查看${name}正文截图原图（新标签页）`}
                >
                  <Image
                    unoptimized
                    src={`/previews/${id}.png`}
                    width={1187}
                    height={id === 'diff' ? 520 : 544}
                    alt={`${name}实际正文比对截图，左侧原文，右侧中度改写；${detail}`}
                    loading="lazy"
                  />
                </a>
                <figcaption>
                  <span>正文比对截图</span>
                  <a
                    href={`/previews/${id}.png`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看原图 <ArrowUpRight size={14} />
                  </a>
                </figcaption>
              </figure>
            </section>
          ),
        )}
      </section>
      <section className="landing-end landing-container">
        <div>
          <p className="landing-kicker">试用内置样本</p>
          <h2>打开示例，检查具体改动。</h2>
          <p>
            四种示例使用固定样本与预计算结果。比对自己的 prompt 与产出，请打开
            Agent 画布。
            <br />
            颜色表示相似程度，不是 AI
            生成概率，不能判定作者归属或事实真伪，也不能断定原意未变。
          </p>
        </div>
        <a className="landing-button" href={startHref}>
          打开比对示例 <ArrowRight size={18} />
        </a>
      </section>
      <footer className="landing-footer landing-container">
        <span>版本比对器 · WORDIFF LAB</span>
        <a href="/privacy">隐私说明</a>
      </footer>
    </main>
  );
}
