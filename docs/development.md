# 开发指南

## 项目结构

| 路径 | 职责 |
| --- | --- |
| `app/page.tsx`、`app/[view]/page.tsx` | 默认入口、四个深链接和版本参数 |
| `app/layout.tsx` | 页面标题、分享元数据与全局字体 |
| `app/globals.css` | 双栏排版、热力图、轻微圆角和响应式样式 |
| `components/wordiff.tsx` | 比较界面、视图切换、原句定位与颜色羽化 |
| `components/ui/` | 按钮、Tabs、Dialog、Switch 基础组件 |
| `lib/types.ts` | 比较数据类型 |
| `content/` | 原文、低中高三个改写正文 |
| `scripts/analyze.py` | 本地分句、jieba、diff 和 embedding 计算 |
| `scripts/verify.py` | 比较数据完整性与一致性验证 |
| `lib/analysis.json` | 应用实际使用的预计算结果 |
| `public/data/` | 可下载的文章、汇总与同一份计算结果 |
| `components/feedback-survey.tsx` | 三题问卷、提交、失败重试与会话去重 |
| `app/auth/callback/` | Google 登录回到浏览器后的认证处理 |
| `app/api/config/`、`app/api/feedback/` | 公开登录配置与服务端反馈 API |
| `supabase/migrations/` | 反馈表、约束与数据库访问策略 |

源码保留 App Router 风格，开发与构建通过 vinext，生产运行在 Cloudflare Workers。环境和部署配置见 [部署指南](deployment.md)。

## 开发流程

```sh
npm ci
npm run dev
```

开发服务器地址以终端输出为准。需要本地测试登录或提交反馈时，复制 `.dev.vars.example` 为 `.dev.vars`，填入自己的 Supabase 测试项目，并把本地 origin 对应的认证回调加入 Supabase 允许列表。不要把生产用户反馈复制进本地夹具。

需要检查接近生产的 Worker 运行环境时：

```sh
npm run build
npm run start
```

`start` 使用构建产物启动 `wrangler dev`，其端口可能不同于开发服务器；相应调整本地 `SITE_URL` 和允许的认证回调。

## 替换语料与重算

1. 替换 `content/original.txt`、`low.txt`、`medium.txt`、`high.txt`。保留这四个标识，除非同时修改类型与版本选择界面。
2. 检查 `components/wordiff.tsx` 中展示标题、署名、事实补充与方法说明，不要让前一篇文章的信息留在自己的实例里。
3. 重算数据并验证。提交 `lib/analysis.json` 与 `public/data/` 中对应产物，使 UI 和下载内容一致。

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/analyze.py
python3 scripts/verify.py
```

首次运行需要网络下载固定版本的模型权重，之后使用本地 CPU 推理。Python 依赖较大，仅修改界面或认证无需重新安装模型或运行推理。不要手改 JSON 的相似度来“改善”颜色；需要调整显示时修改配色函数，需要改变算法时修改 Python 脚本并重算。

详情见 [计算方法与限制](methodology.md)。

## 热力图与圆角

`diffuseHeat` 在相邻分数之间生成柔和的颜色过渡，点击详情仍读取原始分数。保留内联文本、`box-decoration-break: clone` 和零水平间距，避免每个词变成分隔的标签。

正文热力块与审阅高亮使用 5px 圆角，常用控件约 6–8px，纸张和浮层约 10–12px。圆角以 CSS 像素指定；用户所说的轻微倒角按视觉效果落实，避免大幅胶囊化。保持选中与悬浮细边框能辨认，不要用粗边框覆盖羽化。

## 反馈触发与数据

反馈弹窗需要同时满足两个条件：四种比较模式都在前台实际打开过，且累计前台停留时间 **严格大于 600000ms**。访问一个隐藏标签页、后台等待或仅让页面加载完成，都不能替代实际使用。

计时应以单调时钟计算当前前台区间，并响应 `visibilitychange`、窗口聚焦/失焦、页面离开或恢复；后台区间不计入。设备睡眠造成的大段空白不能一次性记成阅读时间。切换视图沿用同一个阅读会话。通过最多三个简短问题收集使用体验，不把问卷作为查看比较内容的门槛。

状态保存在 `sessionStorage` 的 `wordiff:engagement:v1` 中，包含会话 UUID、已使用模式、累计前台毫秒数和问卷状态，不保存跨刷新累计的时间戳。刷新与关闭页面期间不会增加时长；不能访问存储时退回内存状态。关闭或提交问卷后，同一会话不再自动弹出，保存失败保留输入供重试。

计时心跳约为 1 秒。超过 2.5 秒的心跳空档、墙钟与单调时钟明显不一致的时间段均被丢弃；失焦时丢弃最后一个不完整心跳区间。该策略宁可少记一些时间，也不会把后台或休眠间隔全记成阅读。时间是“可见且聚焦”的代理，无法判断用户是否确实在阅读。

问卷三题为：辨别改写的帮助程度（1–5 分）、最有帮助的视图（四选一）、希望改进的地方（可选，最多 2000 字符）。`POST /api/feedback` 支持匿名提交，已登录用户可附带认证信息。数据保存到 `public.feedback`，读取可由部署者在 Supabase 后台进行，前台用户不能列出其他用户的回答。客户端声明的时长仅为体验门槛，不是可信反作弊凭据。

## 验证

基础检查：

```sh
npm test
python3 scripts/verify.py
npm run typecheck
npm run lint
npm run build
```

数据验证覆盖原文一致性、所有分句/分词可无损还原、审阅操作恢复两份全文、Diff 两栏恢复句子序列、匹配引用有效、分数范围、无 tokenizer 截断、零差异自对照和三个改写版本的长度差别。

计时与后端单元测试：

```sh
node --experimental-strip-types --test tests/engagement.test.mjs
node --experimental-strip-types --test supabase/tests/*.test.mjs
```

计时和反馈改动还需验证 10 分钟严格边界、后台暂停、四模式条件、关闭/提交去重、保存失败可重试；认证改动需走真实 Google 回调并检查会话刷新和退出。不要通过在生产暴露任意时间参数的方式跳过问卷门槛。

视觉变动至少检查桌面双栏与手机单栏，观察低、中、高三个版本；检查词语换行、热力图连贯、候选定位、键盘聚焦与弹窗关闭。羽化只改善视觉，不能削弱对不同分数的辨认。

## 适合继续扩展的方向

任意文章输入、在线 embedding 与个人历史记录尚未实现。扩展这些能力时，应明确正文存储位置、模型调用与费用、保存期限以及用户删除数据的路径。现有演示数据为静态预计算，Supabase 目前用于账号和反馈。

## 本次并行开发分支

本次更新先用 `9cb0351` 单独保存已有的羽化与候选原句导航改动，再分出三个 worktree：

| 分支 | 范围 |
| --- | --- |
| `work/auth-supabase` | Google PKCE 登录、Supabase 环境、反馈 API、迁移与隐私页 |
| `work/feedback` | 前台计时、四视图门槛、三题问卷 |
| `work/ui-docs` | 轻微圆角、页面标题、部署与开发文档 |
| `work/integration` | 合并上述分支、Wrangler 云端接线、移动端适配与验收 |

`main` 为验收后的发布版本；分支保留供审阅。本地 worktree 的路径不需要复制到新环境，普通 `git clone` 即可开发。
