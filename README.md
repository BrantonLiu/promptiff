# 版本比对器

[在线体验](https://wordiff.zliu2934.workers.dev) · [源码](https://github.com/BrantonLiu/wordiff)

Wordiff 用来核对原文与 AI 改写的差异。当前提供一篇口述原稿和三种 AI 改写样本，可检查增删改、用词保留和句子相似度；暂不支持导入自己的文本。相似度不能判定作者归属，也不是 AI 生成概率。

- **审阅模式**：字符级增删改，支持隐藏删除内容。
- **类 Git Diff 比对模式**：原文与改写并排，句子内继续标记字符差异。
- **切词比对模式**：jieba 分词、位置和字面匹配，蓝色相近、黄色差距较大。
- **按句语义比对模式**：句向量与原文的余弦相似度，点击查看原句及候选。

热力图保留相邻色块的羽化过渡，使用轻微圆角。内置原文与低、中、高改写可下载；当前版本不提供任意文章上传与在线推理。Google 登录和使用反馈由 Supabase 提供服务，网站通过 Wrangler 部署到 Cloudflare Workers。

## 本地快速启动

需要 Node.js 22.13 或更高版本、npm。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，首页介绍四种算法并展示正文比对截图，点击「查看比对示例」进入审阅页面。四个比对入口是 `/review`、`/diff`、`/lexical`、`/semantic`，`?level=original|low|medium|high` 指定改写强度。仅浏览比较页面无需登录；启用登录和反馈保存需完成下面的后端配置。

## 部署与开发

- [部署指南](docs/deployment.md)：Cloudflare Wrangler、Supabase 数据库、Google 单点登录和环境变量。
- [开发指南](docs/development.md)：项目结构、替换文章、重算结果、前台计时和验证。
- [计算方法与限制](docs/methodology.md)：四种比较算法、配色和模型版本。
- [参与开发](CONTRIBUTING.md)：分支、验证和提交约定。

完成配置后，发布命令为：

```sh
npm run build
npm run deploy
```

`deploy` 使用构建产生的 `dist/server/wrangler.json`。不要把源码目录当静态站点上传，也不要将 Supabase 服务端密钥写入前端代码。

## 内容与再使用

`content/original.txt` 保留作者口述正文；`low.txt`、`medium.txt`、`high.txt` 是基于它生成的 AI 改写样本。展示标题不参与正文比较。原文含未经外部核实的个人陈述，账号首篇文章发布日期仍待核实；编辑补充与判断在页面内单独说明。

本文、示例图片与个人叙述是实验素材，提供源码不代表这些内容自动获得独立转载授权。公开自己的实例前，请替换为本人拥有或已获许可的语料与图片，并检查署名。项目代码采用 [MIT 许可证](LICENSE)。该许可不包含文章正文、个人叙述、示例图片及其他第三方素材；这些内容需要权利人另行许可。
