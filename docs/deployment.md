# 部署到 Cloudflare Workers

网站使用 vinext + React，由 Cloudflare Workers 提供页面与 API。Supabase 提供 Google 身份认证及反馈数据存储。四种比较的语料与结果随应用发布，浏览页面不需要 Supabase 查询或在线模型调用。

## 1. 准备

需要 Node.js 22.13+、npm、可部署 Workers 的 Cloudflare 账号、一个 Supabase 项目，以及可以配置 OAuth 客户端的 Google Cloud 项目。

```sh
npm ci
npx wrangler login
npx wrangler whoami
```

从仓库根目录执行后续命令。确认 Wrangler 显示目标账号；如果账号不止一个，在仓库的 Wrangler 配置中明确选择目标 `account_id`。为自己的实例设置独立 Worker 名称，避免覆盖另一个实例。

## 2. 创建数据库

在自己的 Supabase 项目中打开 SQL Editor，执行 `supabase/migrations/202609100001_feedback.sql`；后续新增迁移时按文件名顺序运行。此迁移创建 `public.feedback` 表。迁移是数据库结构、约束与访问策略的来源，不要只手工创建一张同名表而跳过策略。

也可以使用已配置的 Supabase CLI：

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

在推送前核对项目引用以及 CLI 展示的待执行迁移。上线后保留迁移文件；结构变更新增迁移，不修改已在生产运行过的历史文件。

## 3. 配置 Google 单点登录

配置流程参考 [Supabase Google 登录文档](https://supabase.com/docs/guides/auth/social-login/auth-google) 与 [PKCE 会话流程](https://supabase.com/docs/guides/auth/sessions/pkce-flow)。OAuth 会经过 Google、Supabase、网站三个位置。下面两种回调地址用途不同，配置时按各自位置填写。

| 配置位置 | 值 |
| --- | --- |
| Google Cloud → OAuth Web client → Authorized redirect URIs | `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` |
| Supabase → Authentication → Providers → Google | Google Web client 的 Client ID 与 Client Secret |
| Supabase → Authentication → URL Configuration → Site URL | 你的正式网站 origin，如 `https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev` |
| Supabase → Authentication → URL Configuration → Redirect URLs | `https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev/auth/callback` |

在 Google Cloud 中配置 OAuth consent screen，再创建 **Web application** 类型的 OAuth 客户端。Google Client Secret 只填入 Supabase Google Provider 设置，不需要放入本项目的前端或 Worker 环境变量。若 Google 应用仍处于测试状态，把测试登录使用的 Google 账号加入测试用户；对外开放前检查应用发布状态和 Google 的相应要求。

网站回调路径是 `/auth/callback`。本地开发可添加 `http://localhost:3000/auth/callback`（端口以实际开发服务器为准）。为生产域名、需要登录的本地开发地址分别添加精确回调 URL；更换域名时同步修改 Supabase 的 Site URL、Redirect URLs 与 Worker 的 `SITE_URL`。

## 4. 设置环境变量

| 变量 | 用途 | 存放位置 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目 API origin | Worker 服务端环境 |
| `SUPABASE_ANON_KEY` | Supabase 项目匿名 key，用于认证请求 | Worker 服务端环境 |
| `SUPABASE_SERVICE_ROLE_KEY` | 写入反馈等服务端数据库操作 | **仅服务端 secret** |
| `SITE_URL` | 本实例外部 origin，生成认证回调和页面分享地址 | Worker 服务端环境 |

从 Supabase 项目设置中复制对应值，不要把数据库密码误填为 API key，也不要把 service role key 填到匿名 key 字段。`/api/config` 仅向浏览器返回项目 URL 与匿名 key，这是浏览器 OAuth 所需的公开配置；数据库访问由 RLS 限制，service role key 不会由该接口返回。环境模板只提供占位符，不能直接使用。

本地开发与 `wrangler dev` 均可使用被 Git 忽略的 `.dev.vars`。从模板复制后填写自己的项目值：

```sh
cp .dev.vars.example .dev.vars
```

`SITE_URL` 必须与浏览器实际访问的本地 origin 一致，包括端口。生产环境使用 HTTPS origin，不带路径、查询参数或 fragment。

先构建，随后把配置写入构建产物指向的 Worker：

```sh
npm run build
npx wrangler secret put SUPABASE_URL --config dist/server/wrangler.json
npx wrangler secret put SUPABASE_ANON_KEY --config dist/server/wrangler.json
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config dist/server/wrangler.json
npx wrangler secret put SITE_URL --config dist/server/wrangler.json
npm run deploy
```

`wrangler secret put` 通过交互输入读取值，避免凭据落入 shell 命令历史。若首次部署尚未创建 Worker，按 Wrangler 提示创建目标 Worker，再设置上述 secrets。发布后配置由 Cloudflare 保存；重新构建不会把本地 `.dev.vars` 打包发布为生产密钥。

实际发布脚本使用：

```sh
wrangler deploy --config dist/server/wrangler.json
```

源码的 Wrangler 配置负责构建环境；最终发布使用 vinext/Cloudflare Vite 插件生成的配置，以保留正确的服务端入口与静态资源 binding。不要手工修改 `dist/server/wrangler.json`，下一次构建会覆盖它。

## 5. 上线验收

- 页面标题是“版本比对器”；四个视图、四种改写强度和全文下载正常。
- 点击 Google 登录，最终回到同一生产站点；刷新后仍能识别登录用户，退出后不再显示账号。
- 分别打开四种比较方式，在前台累计使用超过 10 分钟后出现反馈弹窗。切到后台、最小化或切到其他窗口时计时暂停；不能把等待 10 分钟的后台标签页算作实际使用。
- 反馈最多三个问题。提交一份可辨识的测试反馈，在 Supabase 表编辑器中核对保存结果；检查浏览器没有收到 service role key。
- 关闭或提交反馈后，在同一浏览会话内切换视图不应反复弹出。

如需快速验证边界，用开发指南中的自动化计时测试；不要为了验收把生产阈值改成几秒。

## 6. 常见问题

| 现象 | 优先检查 |
| --- | --- |
| Google 提示 `redirect_uri_mismatch` | Google Web client 中填写的应为 Supabase `/auth/v1/callback`，项目引用必须正确 |
| Google 返回后回到错误网站 | Supabase Site URL、Redirect URLs 和 Worker `SITE_URL` 是否全部使用同一环境 |
| 登录显示服务未配置 | Worker secrets 是否配置在本次发布的同名 Worker 中 |
| 登录有效但反馈保存失败 | 是否执行全部迁移、service role key 是否属于同一 Supabase 项目，以及 Worker 日志 |
| 后台等待没有弹窗 | 这是预期行为；只累计前台可见且窗口聚焦的实际时间 |
| 部署后深链接或 API 404 | 是否使用构建生成的 Wrangler 配置，而不是上传 `public/` 静态文件 |

通过 `npx wrangler tail --config dist/server/wrangler.json` 查看 Worker 日志。排查时不要把 token、密钥或用户反馈正文贴到公开 issue。

## 7. 更新与回滚

常规代码更新完成验证后重新执行 `npm run build`、`npm run deploy`。发布前记录当前提交 SHA 和 Cloudflare deployment ID；需要回滚时在 Cloudflare Workers 的 Deployments 页面选定之前的部署。代码回滚不会撤销数据库迁移，数据库回退应使用单独审查的迁移，并先确认数据备份。

## 认证接口

| 路由 | 用途 |
| --- | --- |
| `GET /api/config` | 提供 Supabase URL、匿名 key 等登录所需公开配置，不返回 service role key |
| `/auth/callback` | 浏览器完成 PKCE code exchange，使用同源 localStorage 中的 verifier |
| `POST /api/feedback` | 验证请求并由服务端写入反馈，支持匿名或已登录用户 |

问卷无需强制登录。已登录时，服务端验证 bearer token 后关联用户；数据库使用 RLS 阻止浏览器直接读取或写入反馈表。首次成功保存返回 `201`，同一会话重试已保存的反馈返回 `200` 与 `duplicate: true`，避免重复记录。

问卷上报的前台时长用于研究体验，属于客户端声明；即使后端检查阈值，也不能将它当成可信的反作弊证据。
