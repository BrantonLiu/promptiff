# wordiff

一份真实口述、三种 AI 改写、四种比较方式。

## 运行

```sh
npm ci
npm run dev
```

访问 http://localhost:3000。四个独立入口是 `/review`、`/diff`、`/lexical`、`/semantic`。`?level=low|medium|high|original` 指定改写强度。页面支持下载全文和计算数据；内置样本固定，不提供任意文本在线计算。

## 内容

`content/original.txt` 保留用户本次口述正文；低、中、高改写分别为 `low.txt`、`medium.txt`、`high.txt`。三个版本由助手基于这份原稿直接撰写，不由 diff 算法生成。版面中的展示标题另行标明，不计入正文比较。

原文与各版本包含未经外部核实的个人陈述。首次发表日期来源：[中共中央党史和文献研究院](https://www.dswxyjy.org.cn/GB/434461/434473/434979/index.html)。账号第一篇发布日期待核实。改写弱化了部分无法从原稿证实的断言；页面“事实补充与编辑判断”列出具体介入，不把它们当作作者已确认的意见。

## 真实计算与复现

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/analyze.py
python3 scripts/verify.py
```

首次运行会从 Hugging Face 下载模型；文章推理在本机 CPU 上运行，不发送到推理 API。网页读取 `public/data/analysis.json` 的真实预计算结果。模型权重不打包进网页。

- **审阅**：Python `difflib.SequenceMatcher(autojunk=False)`，全文字符差异。替换拆成红色删除和黄色新文字，纯增加为灰蓝色。
- **逐句 Diff**：比较单元作为行。替换块的位置配对是展示安排，不表示语义匹配。长句超过 100 字时按逗号拆分，再必要时定长拆分，拼接无损。
- **分词热力图**：jieba 0.42.1 精确模式/HMM。选原句时使用 65% IDF 加权词语 Dice + 35% 字符二元组 Dice。然后对词做 LCS，原位相同为 1；移位复用 0.65–0.85；新词为 0.05 + 0.5×最佳字形相似度。标点取最近词的颜色。
- **语义热力图**：`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`，模型自带 tokenizer、mean pooling、L2 归一化、384 维向量、余弦最近邻。模型固定 revision `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`。每个改写句匹配所有原文句，保留前三候选。没有把词频或字符算法冒充 embedding。

字面颜色 0–1，语义颜色 0.45–0.95，共用蓝（相近）到黄（差距大）色带，区间外颜色饱和。相邻词无间隙拼接，色阶连续插值。语义色块粒度是句子/长分句，不是词级归因。

字数为非空白字符，含标点与数字。原样保留率分母是改写稿长度，段落重排降低它。平均语义相似度按目标句字符数加权、单向最近邻，无法充分揭示被删除的主张。逆向覆盖指标使用 0.75 的参考阈值。颜色与分数都不是作者归属、事实正确性或 AI 生成概率，尤其不能可靠识别否定和数字变化。

## 验证

```sh
python3 scripts/verify.py
npx tsc --noEmit
npm run lint
npm run build
```

验证覆盖原文一致性、全部分句/分词可无损还原、审阅操作可还原两份全文、Diff 两栏可还原句子序列、匹配引用有效、分数范围、无 tokenizer 截断、零差异自对照和三个版本的真实长度差别。
