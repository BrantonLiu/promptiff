# Claude CLI · GLM-5.3 原始建议

此页保留模型原始建议，供比较使用，并非全部采用。算法中“先去空白”的说法有误，最终稿已按代码纠正。

整体判断：全站文案以事实描述为主，主要问题集中在四处——首页与工作区的口号式主标题（“文字变了，意思呢？”“意思走远”“有迹可循”）、四种模式命名不统一、Dice 相似度从未向普通读者解释、方法弹窗标题用反问句。本次按统一命名（审阅模式、类 Git Diff 比对模式、切词比对模式、按句语义比对模式）替换所有出现位置（页面、标签、图例、问卷选项、SEO 描述、README、方法文档），补写 Dice 的通俗解释并注明“综合分只用于找原句，不是词语着色分数”，删除口号与“意思走远”类修辞。全文未发现承诺导入或上传功能的表述（首页已写明“暂不支持上传文章”），予以保留；隐私条款、事实补充、算法说明、错误提示等直白准确的内容原样保留；改写正文与指标数据未触碰。

## 逐项文案

| 文件 | 原文 | 建议 | 理由 |
| --- | --- | --- | --- |
| app/page.tsx | name: '逐句 Diff', | name: '类 Git Diff 比对模式', | 统一模式命名 |
| app/page.tsx | title: '把长文拆开，逐行对照。', | title: '类 Git Diff 比对模式', | 按要求将此标题改为模式名 |
| app/page.tsx | name: '分词热力图', | name: '切词比对模式', | 统一模式命名 |
| app/page.tsx | title: '哪些词，还留着原来的痕迹？', | title: '切词比对模式', | 按要求替换，去除“痕迹”修辞 |
| app/page.tsx | name: '语义热力图', | name: '按句语义比对模式', | 统一模式命名 |
| app/page.tsx | title: '换了说法，意思走远了吗？', | title: '按句语义比对模式', | 删除“意思走远”与问句，与其他已改名模式一致 |
| app/page.tsx | '用 jieba 精确模式（HMM）分词，以 65% IDF 加权词语 Dice + 35% 字符二元组 Dice，检索最接近的原句。', | '用 jieba 精确模式（HMM）分词，以 65% IDF 加权词语 Dice + 35% 字符二元组 Dice 检索最接近的原句。Dice 衡量两句话的重合程度：词语 Dice 对每个词取两句中出现次数的较小值作为共有数量，按 IDF 加权（原文中越少见的词权重越高），得分 = 2 × 共有词权重 ÷ 两句词权重总和；字符二元组 Dice 先去掉空白，把相邻两个字符切成一组，得分 = 2 × 共有片段数 ÷ 两句片段总数。这个综合分只用来寻找原句，不是词语着色的分数。', | 向普通读者解释 Dice，并说明该分不用于着色；单行字符串不加换行 |
| app/page.tsx | &lt;h4&gt;怎么算&lt;/h4&gt; | &lt;h4&gt;算法原理&lt;/h4&gt; | 按要求改名 |
| app/page.tsx | &lt;h4&gt;怎么看&lt;/h4&gt; | &lt;h4&gt;比对方式&lt;/h4&gt; | 按要求改名 |
| app/page.tsx | 文字变了，<br>            &lt;br /&gt;<br>            &lt;span&gt;意思呢？&lt;/span&gt; | 核对 AI 改写，<br>            &lt;br /&gt;<br>            &lt;span&gt;一处一处来。&lt;/span&gt; | 用户点名“非常 AI”的主标题，改为直接说明用途 |
| app/page.tsx | 同一篇口述，三种 AI 改写。<br>            &lt;br /&gt;<br>            从一个字到一句话，看清哪些表达被保留，哪些意思走远了。 | 同一篇口述，低、中、高三种 AI 改写。<br>            &lt;br /&gt;<br>            从字到句逐处查看：哪些表达保留了，哪些说法换了。 | 删除“意思走远”，改为具体可做的事 |
| app/page.tsx | &lt;Sparkles size={16} /&gt; 语义热力图 | &lt;Sparkles size={16} /&gt; 按句语义比对模式 | 预览栏同步统一命名 |
| app/page.tsx | &lt;span&gt;同一段文字，另一种表达。&lt;/span&gt; | &lt;span&gt;中度改写的实际比对画面。&lt;/span&gt; | 抒情句改为说明截图内容 |
| app/page.tsx | 从文字的变化，看到意思的距离。 | 四种比对方式，从字、词、句逐层检查。 | 对仗式口号改为具体信息 |
| app/page.tsx | 让每一处改写，有迹可循。 | 打开比对页面，逐处检查。 | 按要求删除口号 |
| components/wordiff.tsx | {id:'diff',icon:GitCompareArrows,label:'逐句 Diff',hint:'将长段落拆成句子，再做逐行比较'}, | {id:'diff',icon:GitCompareArrows,label:'类 Git Diff 比对模式',hint:'将长段落拆成句子，再做逐行比较'}, | 统一模式命名，hint 直白保留 |
| components/wordiff.tsx | {id:'lexical',icon:Grid2X2,label:'分词热力图',hint:'字词相近，不一定意思相同'}, | {id:'lexical',icon:Grid2X2,label:'切词比对模式',hint:'字词相近，不一定意思相同'}, | 统一模式命名 |
| components/wordiff.tsx | {id:'semantic',icon:Sparkles,label:'语义热力图',hint:'换了说法，意思也可能仍然接近'}, | {id:'semantic',icon:Sparkles,label:'按句语义比对模式',hint:'换了说法，意思也可能仍然接近'}, | 统一模式命名 |
| components/wordiff.tsx | &lt;span className="top-caption"&gt;让改写有迹可循&lt;/span&gt; | &lt;span className="top-caption"&gt;原文与 AI 改写逐处比对&lt;/span&gt; | 删除“有迹可循”口号，改为描述功能 |
| components/wordiff.tsx | &lt;h1&gt;文字变了，意思呢？&lt;/h1&gt;&lt;p&gt;同一篇口述，三种改写程度。看看哪些表达被保留，哪些意思走远了。&lt;/p&gt; | &lt;h1&gt;核对 AI 改写，一处一处来&lt;/h1&gt;&lt;p&gt;同一篇口述，三种改写程度。逐处查看哪些表达保留了、哪些说法换了。&lt;/p&gt; | 与首页同步替换口号式标题和“意思走远” |
| components/wordiff.tsx | '句子级 · 真实 embedding' | '句子级 · embedding 余弦相似度' | 去掉含混的“真实”，改为具体指标名 |
| components/wordiff.tsx | {mode==='semantic'?'语义匹配依据':'分词匹配依据'} | {mode==='semantic'?'按句语义匹配依据':'切词匹配依据'} | 详情面板同步统一命名 |
| components/wordiff.tsx | &lt;DialogTitle&gt;我们究竟在比较什么？&lt;/DialogTitle&gt; | &lt;DialogTitle&gt;比对方法与数据说明&lt;/DialogTitle&gt; | 反问式标题改为直述 |
| components/wordiff.tsx | 逐句 Diff 把句子作为行，长句再按逗号拆分；重排仍会表现为删除与增加。 | 类 Git Diff 比对模式把句子作为行，长句再按逗号拆分；重排仍会表现为删除与增加。 | 方法说明同步统一命名 |
| components/wordiff.tsx | 每句先用 IDF 加权词语重合（65%）和二字片段重合（35%）寻找原句，再按词序、复用位置及字形相似度给词语着色。 | 每句先用 IDF 加权词语 Dice（65%）和字符二元组 Dice（35%）寻找原句。Dice 衡量两句重合程度：词语对每个词取两句中出现次数的较小值作为共有数量，按 IDF 加权（原文中越少见的词权重越高）；字符二元组先去掉空白，按相邻两个字符切分。得分都是 2 × 共有部分 ÷ 两句总和，只用于找原句，不是词语着色的分数。找到后再按词序、复用位置及字形相似度给词语着色。 | 在弹窗中补上 Dice 通俗解释并澄清分数用途 |
| components/wordiff.tsx | &lt;h3&gt;03 / 真实语义向量&lt;/h3&gt; | &lt;h3&gt;03 / 语义向量计算&lt;/h3&gt; | 去掉含混的“真实”，标题直述内容 |
| components/wordiff.tsx | 真实算法 · 全文比较 · 本地预计算 | 全文比对 · 本地预计算 | “真实算法”属辩解式表述，删除 |
| components/feedback-survey.tsx |   review: '审阅模式', diff: '逐句 Diff', lexical: '分词热力图', semantic: '语义热力图', |   review: '审阅模式', diff: '类 Git Diff 比对模式', lexical: '切词比对模式', semantic: '按句语义比对模式', | 问卷选项同步统一命名，避免与界面不一致 |
| app/privacy/page.tsx | 切换审阅、Diff、分词和语义视图时，不会把文章实时发送给大模型重新分析。 | 切换四种比对视图时，不会把文章实时发送给大模型重新分析。 | 旧模式简称随命名失效，改为总数表述；隐私事实不变 |
| app/layout.tsx | description: '用审阅、逐句 Diff、结巴分词与语义向量，对照一篇口述和三种 AI 改写。', | description: '用审阅模式、类 Git Diff、切词比对和按句语义比对，对照一篇口述和三种 AI 改写。', | SEO 描述同步统一命名 |
| app/layout.tsx | '同一篇口述，三种改写程度，四种观察方式。' | '同一篇口述，三种改写程度，四种比对方式。' | 与站内“比对方式”用语统一（openGraph 与 twitter 两处相同文案共用此替换） |
| components/ui/dialog.tsx | &lt;span className="sr-only"&gt;Close&lt;/span&gt; | &lt;span className="sr-only"&gt;关闭&lt;/span&gt; | 中文站点的读屏标签应用中文 |
| components/ui/dialog.tsx | render={&lt;Button variant="outline" /&gt;}&gt;<br>          Close<br>        &lt;/DialogPrimitive.Close&gt; | render={&lt;Button variant="outline" /&gt;}&gt;<br>          关闭<br>        &lt;/DialogPrimitive.Close&gt; | 同上，可见回退文案改为中文 |
| README.md | 一份真实口述、三种 AI 改写、四种比较方式。 | 一份真实口述、三种 AI 改写、四种比对方式。 | 与站内“比对方式”用语统一 |
| README.md | - **逐句 Diff**：原文与改写并排，句子内继续标记词语差异。 | - **类 Git Diff 比对模式**：原文与改写并排，句子内继续标记词语差异。 | 统一模式命名 |
| README.md | - **分词热力图**：jieba 分词、位置和字面匹配，蓝色相近、黄色差距较大。 | - **切词比对模式**：jieba 分词、位置和字面匹配，蓝色相近、黄色差距较大。 | 统一模式命名 |
| README.md | - **语义热力图**：真实句向量与原文的余弦相似度，点击查看原句及候选。 | - **按句语义比对模式**：句向量与原文的余弦相似度，点击查看原句及候选。 | 统一模式命名并去掉“真实”修饰 |
| docs/methodology.md | ## 四种观察方式 | ## 四种比对方式 | 与站内用语统一 |
| docs/methodology.md | &#124; 审阅 &#124; 全文字符 &#124; | &#124; 审阅模式 &#124; 全文字符 &#124; | 统一模式命名 |
| docs/methodology.md | &#124; 逐句 Diff &#124; 句子与长分句 &#124; | &#124; 类 Git Diff 比对模式 &#124; 句子与长分句 &#124; | 统一模式命名 |
| docs/methodology.md | &#124; 分词热力图 &#124; jieba 词语 &#124; | &#124; 切词比对模式 &#124; jieba 词语 &#124; | 统一模式命名 |
| docs/methodology.md | &#124; 语义热力图 &#124; 句子与长分句 &#124; | &#124; 按句语义比对模式 &#124; 句子与长分句 &#124; | 统一模式命名 |
| docs/methodology.md | &#124; 真实 embedding，归一化向量余弦最近邻 &#124; | &#124; 归一化向量余弦最近邻 &#124; | 去掉“真实”修饰，表格更简洁 |
| docs/methodology.md | 逐句 Diff 的替换块按位置配对只服务于版面，不代表语义对应。 | 类 Git Diff 比对模式的替换块按位置配对只服务于版面，不代表语义对应。 | 统一模式命名 |
| docs/methodology.md | ## 分词热力图 | ## 切词比对模式 | 统一模式命名 |
| docs/methodology.md | ## 语义热力图 | ## 按句语义比对模式 | 统一模式命名 |
| docs/methodology.md | 找到原句后，通过最长匹配序列计算词语保留： | Dice 相似度衡量两句话的重合程度。词语 Dice：每个词取两句中出现次数的较小值作为共有数量，按 IDF 加权（原文中较少出现的词权重越高），得分 = 2 × 共有词权重 ÷ 两句词权重总和。字符二元组 Dice：先去掉空白，把相邻两个字符切成一组，得分 = 2 × 共有片段数 ÷ 两句片段总数。这个综合分只用来寻找最接近的原句，不是词语着色使用的分数。<br><br>找到原句后，通过最长匹配序列计算词语保留： | 方法文档补写 Dice 定义，位置紧接公式，并澄清分数边界 |
| app/api/feedback/route.ts | 反馈需要使用 JSON 格式提交。 | 请用 JSON 格式提交反馈。 | 「需要使用……提交」是翻译腔的名词化句式；改为直接祈使句，JSON 这一功能事实不变。 |
| app/api/feedback/route.ts | 请完成四种视图体验、有效停留超过 10 分钟，并检查反馈内容。 | 请先体验全部四种视图、有效停留超过 10 分钟，检查反馈内容后再提交。 | 「完成四种视图体验」把动词名词化，生硬；「并检查反馈内容」说完动作却没有下文。改为动词句并用「先……再提交」交代清楚步骤，条件事实（四种视图、超过 10 分钟）原样保留。 |
| app/api/feedback/route.ts | 反馈服务尚未配置，请稍后重试。 | 反馈服务尚未配置，暂时无法提交反馈。 | 配置缺失不是等一会儿就能自愈的临时故障，「请稍后重试」是套话且误导；直接说明当前无法提交，与 503 的真实原因一致。 |
| app/api/feedback/route.ts | 反馈暂时保存失败，请稍后重试。 | 反馈保存失败，请稍后重试。 | 「暂时」是对冲式修饰，删掉后语义不变、更直接；「请稍后重试」已表达可重试。 |

## 审阅范围与保留内容

| 文件 | 已审核范围 | 保留理由 |
| --- | --- | --- |
| app/page.tsx | features 数组的 name/unit/title/description/steps/detail/note、hero 主标题与导语、按钮与导航文案、图例、figcaption、alt、aria-label、landing-end 免责说明、页脚 | 保留：审阅模式标题“改了哪个字，一眼看见。”及各模式 description/detail/note（均具体准确）；“无需登录即可体验 · 内置低 / 中 / 高三种改写”“暂不支持上传文章”“颜色表示相似程度，不是 AI 生成概率”等事实说明；路由、JSX 结构与图标不变 |
| components/wordiff.tsx | 模式标签与 hint、等级选择器、统计条、图例、Git 面板与表尾说明、双栏标题与脚注、弹窗全文（01–05 节）、inspector 文案、toast、footer、aria-label 与 title 属性 | 保留：等级描述、方法弹窗 01/04/05 节的事实陈述、错误与复制提示、“点击色块，追溯对应原句”“下一处明显变化”等具体交互文案、改写正文与标题内容（算法输入，不可润色）、代码与数据引用 |
| components/feedback-survey.tsx | 问卷标题、说明、三题题干与选项标签、占位符、错误与致谢文案、隐私提示 | 保留：全部问卷问句（真实调查问题，非修辞问句）、占位符示例、错误重试与数据说明；仅改模式名 |
| components/auth-button.tsx | 登录/退出按钮、title 提示、加载与错误文案 | 全部保留：短且直白，无 AI 味 |
| components/auth-provider.tsx | 登录状态读取、登录/退出失败的错误文案 | 全部保留：错误信息具体可操作 |
| app/privacy/page.tsx | metadata、各节标题与全部段落、链接与联系信息 | 除一句视图列举外全部保留：隐私条款信息完整，不增删任何承诺 |
| app/auth/callback/page.tsx | 标题、进行中/错误状态与返回链接文案 | 全部保留：错误信息具体，无修辞 |
| app/layout.tsx | title、description、openGraph 与 twitter 元数据 | 保留站点名“版本比对器”与 og.png 引用；仅更新模式名与用语 |
| components/ui/dialog.tsx | sr-only 关闭标签与 DialogFooter 回退文案 | 其余为纯组件代码，无面向读者文字 |
| README.md | 项目简介、四模式列表、能力边界说明、快速启动、部署与开发指引、内容与授权段落 | 保留：本地启动、命令、URL 参数、部署说明、内容授权与待核实事实（“当前版本不提供任意文章上传与在线推理”等边界表述原样保留） |
| docs/methodology.md | 四种方式表格、切词与语义两节、配色与指标、样本事实补充 | 保留：全部算法常数、模型版本、色阶区间、指标边界与“相似度不能判定作者归属/事实”等限制说明；仅统一命名并补 Dice 解释 |
| docs/development.md | 项目结构表、开发流程、替换语料、热力图圆角、反馈计时、验证清单、扩展方向、分支说明 | 全部保留：面向开发者的技术文档，无口号式文案，未使用旧模式名 |
| docs/deployment.md | 准备、数据库、OAuth 配置、环境变量、验收清单、常见问题、回滚与 API 说明 | 全部保留：配置步骤与表格为技术事实，未使用旧模式名，无 AI 味表述 |
| CONTRIBUTING.md | 修改与验证流程、值得保留的行为、内容与授权 | 全部保留：约定类文档，表述直接，未使用旧模式名 |
| app/api/feedback/route.ts | 全部 9 条用户可见错误文案（含两处相同的 INVALID_SESSION） | 保留 5 条原文：INVALID_ORIGIN「请从版本比对器页面提交反馈。」指明具体页面、直接可操作；INVALID_JSON「反馈格式有误，请重试。」简短清楚；BODY_TOO_LARGE「反馈内容过长，请缩短后重试。」给出具体补救动作；INVALID_SESSION 两处「登录状态已失效，请重新登录后重试。」错误与补救都直接（两处字符串相同，未列入 replacements）；SERVICE_UNAVAILABLE「反馈服务暂时无法连接，请稍后重试。」的「暂时」与临时连接故障、可重试的指引相符，保留。 |
| app/api/feedback/route.ts | 错误码与状态码（INVALID_ORIGIN、INVALID_CONTENT_TYPE、BODY_TOO_LARGE、INVALID_JSON、INVALID_FEEDBACK、NOT_CONFIGURED、INVALID_SESSION、SAVE_FAILED、SERVICE_UNAVAILABLE、23505、403/413/415/400/401/503/502/201）、内部哨兵值 'BODY_TOO_LARGE'、英文注释、Supabase 客户端与鉴权逻辑 | 均非用户文案，属功能事实与代码逻辑，一律保留原样，不做替换。 |
