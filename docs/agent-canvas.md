# Agent 比对画布

在独立分支 `codex/agent-canvas` 开发。网站入口 `/canvas`，原有四种示例视图保留。此分支合并/发布前，GitHub 默认分支不保证包含安装文件；开发试用应指定本地 checkout 或该功能分支。

## 复制给 Agent 的指令

网站右上角「接入你的 Agent」按 Skill / CLI 和计算方式生成指令。可直接复制下面这段：

> 请安装 Wordiff 本地比对工具。读取 https://github.com/BrantonLiu/wordiff 中 docs/agent-canvas.md；开发版使用 codex/agent-canvas 分支或已提供的本地 checkout。将项目放在专用工具目录，不覆盖已有文件。使用 Node 22.13+，运行 `node cli/wordiff.mjs install --target <你的技能目录>`（Codex 通常为 `~/.agents/skills`）。只采集当前任务可见的用户原始 prompt 和我选择的 AI 产出，保留轮次，不带系统指令、工具日志、凭证或其他对话。Codex 用 `capture --current --out <新的 session.json 路径>`；不支持当前任务日志时从可见上下文导出文档里的 JSON，不能猜测缺失的原文。运行 `serve --session <文件> --engine lexical`，保持进程存活，在侧边浏览器或普通浏览器打开返回的完整链接。若我要真实语义比对，使用本文档的本地模型方式；只有我选择远程并允许上传时才使用远程方式。

这段指令不依赖某款 Agent 能执行任意隐藏 API。Skill 是可被 Agent 发现的使用说明，CLI 执行确定性采集和本地服务；网页本身不能读取 Agent 会话。DSH 未确认具体产品及会话接口，暂使用通用 JSON 导出路径。

## 本地安装与运行

```sh
# 在已下载的 Wordiff checkout 中运行；基础 CLI 无需 npm install。
node cli/wordiff.mjs install --target ~/.agents/skills
node cli/wordiff.mjs capture --current --out /absolute/path/session.json
node cli/wordiff.mjs serve --session /absolute/path/session.json
```

安装器打包 Skill、CLI 和同一份静态画布到 `wordiff-canvas/runtime`，安装后不依赖原仓库位置。安装器拒绝覆盖已有技能；更新前先自行移走或备份旧版。只用 CLI 的用户跳过 `install`，直接执行 `serve`。使用 `node cli/wordiff.mjs --help` 查看参数。

默认随机空闲端口，只监听 `127.0.0.1`。CLI 输出带 fragment 令牌的完整 URL，令牌不传到远程网页；本地 JSON / 模型接口需要 Bearer 令牌，并检查 Host、Origin，阻止跨站读取。服务不会读取任意文件路径，也不会将 API key 发到浏览器。退出服务后原链接失效。原始 JSON 使用权限 0600 新建，不覆盖同名文件。

用多个 `--session` 加载用户明确选择的历史对话。`capture --current` 仅按 `CODEX_THREAD_ID` 匹配 `$CODEX_HOME/sessions` 中的文件名，不读取其他会话正文。日志格式不是稳定公共 API，已支持 `response_item` 和旧版 `event_msg`，忽略系统/开发者消息、工具调用和 commentary；缺少会话 ID 时不猜测最近会话。导出后仍需核对轮次与原文范围，压缩掉或不可见的内容无法恢复。本次运行是快照；会话继续后可重新导出并刷新本地服务。

## 数据格式

```json
{
  "version": 1,
  "title": "产品方案讨论",
  "turns": [
    { "id": "t1", "label": "01 · 原始要求", "text": "任务只保存在本地。" },
    { "id": "t2", "label": "02 · 补充要求", "text": "增加导出 CSV 的功能。" }
  ],
  "artifacts": [
    { "id": "a1", "title": "初稿.md", "turnId": "t1", "format": "markdown", "text": "任务保存在云端。" },
    { "id": "a2", "title": "方案.md", "turnId": "t2", "format": "markdown", "text": "任务保存在本地，支持导出 CSV。" }
  ]
}
```

数组顺序即对话顺序。`turnId` 是产出生成前最后一轮用户输入；选择初稿时后续要求不可选。支持 text、markdown、json、csv、html、code。Markdown 提供基础标题、段落和代码块预览；HTML/代码显示安全源码，不执行脚本，不加载产出内链接或远程资源。PDF/DOCX/图片需由 Agent 先提取文字并标注来源，不支持版式或像素比对。

单个会话最多 100 轮、50 个产出、60,000 字符；单次最多 600 句，长句按 100 个 Unicode 字符分块。网站可以导入 JSON、直接粘贴一组文本、追加文本产出；所有操作只在当前页面内存中，刷新会丢失，使用「导出会话」主动保存。

## 三种计算方式

### 字面比对

无需安装依赖。以字符二元组 Dice 计算句间距离，按每句最近邻展示双向覆盖。逐句修订在字面最近句之间做字符 LCS，不声称因果归因。

### 本地语义

```sh
python3 -m venv .venv
.venv/bin/pip install -r cli/requirements.txt
node cli/wordiff.mjs serve --session /absolute/path/session.json --engine local --python .venv/bin/python
```

首次计算下载 `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`，固定 revision `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`，与原站方法一致。之后使用本地缓存，在 CPU 上推理，不将文本发送到推理服务。需要自行提供可用 Python 环境、模型磁盘空间与内存。每次新的选择启动一次 Python 模型进程；同一选择在页面内缓存，持续工作进程优化尚未实现。超过 tokenizer 限制时明确报错，不静默截断。

### 远程语义（自有 API）

在本地进程环境设置：

- `WORDIFF_API_URL`：完整的 HTTPS embeddings 端点。
- `WORDIFF_API_KEY`：服务密钥，勿写进 Git、会话 JSON 或浏览器。
- `WORDIFF_MODEL`：该服务支持的 embedding 模型名。

```sh
node cli/wordiff.mjs serve --session /absolute/path/session.json --engine remote --allow-remote
```

选择该模式后，浏览器提示远程服务域名；服务只发送当前筛选的 prompt / 产出句子，不发送 Skill、其他会话或系统指令。HTTP 请求为 `POST`，Bearer 认证，请求体 `{model, input: string[], encoding_format: "float"}`，响应为 `{data: [{index, embedding: number[]}]}`。拒绝 HTTP、重定向、索引缺失、零向量和维度不一致。前端仍在本地计算余弦、覆盖和显示。

这提供了将来平台算力服务可实现的兼容接口。目前没有 Wordiff 付费、注册、API key 发放、计费或远程报告托管服务，也不把已有 Google 登录当作付费授权。将来如需远程链接，需额外实现有访问控制、生命周期和删除能力的报告存储；本版不会伪造分享地址。

## 如何读结果

语义来自真实句向量余弦。未配置/计算失败时清楚标注字面预览，不输出伪语义分数。平均值按输出字符加权，不能解释为「满足了多少百分比的原意」。参考阈值可调；右侧逆向覆盖帮助发现丢失的要求，正向匹配帮助发现新增内容。高相似度也可能隐藏否定、主体或数字变化，需人工检查。多轮指令矛盾不会被算法自行裁定，也不会自动视作被后续 prompt 撤销。

## Codex 分发边界

官方支持本地 Skill 和插件分发。此版本交付 Skill + CLI，未上架公共市场；插件包装可以复用同一 Skill 和 runtime，公开目录仍需按平台流程提交与审核，不承诺自动上架。侧边打开仅在宿主提供浏览器面板工具时调用，否则返回普通本地链接。

参考：[Codex Skill 路径与发现](https://learn.chatgpt.com/docs/build-skills)、[插件与市场分发](https://learn.chatgpt.com/docs/plugins)。

## 验证

```sh
npm test
npm run typecheck
npm run build
```

新增测试覆盖 Unicode 分句、双向覆盖、字符 diff 重建、非法数据、当前会话定位、重复日志、远程模式授权、向量校验、本地 API 防护及独立安装包。

开发验证记录：26 项测试、TypeScript、lint 与完整 Vinext 构建通过。通过本地 HTTP embeddings 接口实际计算了 384 维向量，并在 `HF_HUB_OFFLINE=1` 下验证缓存推理。远程协议使用模拟服务验证请求范围和响应排序，尚未接入真实付费服务。此分支将 Wrangler compatibility_date 调整为现有锁定 runtime 支持的 2026-05-22，以使本地预览可启动。尚未进行浏览器交互/截图测试。
