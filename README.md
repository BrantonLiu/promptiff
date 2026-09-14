# Wordiff · Agent 比对画布

把一轮或多轮用户 prompt 与选定的 AI 产出并排阅读，检查变化、遗漏和新增内容。支持语义比对、逐词比对、Git比对、逐字比对，以及独立的原文预览，以及 Markdown、纯文本、JSON、CSV、HTML 源码和代码。

本仓库提供独立的本地 CLI、画布和 Skill。自营网站、登录、反馈数据库及生产部署配置在独立仓库维护。

## 快速体验

需要 Node.js 22.13+，基础功能无需安装 npm 依赖：

```sh
git clone https://github.com/BrantonLiu/wordiff.git
cd wordiff
node cli/wordiff.mjs serve --session examples/session.json
```

打开终端输出的完整本地链接。服务只监听 127.0.0.1；保持进程运行，按 Ctrl-C 关闭。在设置里可以导入会话 JSON，或粘贴自己的 prompt 和产出。

## 在 Agent 中使用

```sh
node cli/wordiff.mjs install --target ~/.agents/skills
node cli/wordiff.mjs capture --current --out /absolute/private/path/session.json
node cli/wordiff.mjs serve --session /absolute/private/path/session.json
```

安装器不覆盖已有 Skill。capture 仅在当前 Codex 任务环境中采集该任务；也支持手工准备 JSON。[Agent 接入说明](docs/agent-canvas.md)提供可复制给 Agent 的指令、数据格式和模型配置。当前交付 Skill 与 CLI，尚未上架公共插件市场。

## 计算方式

- lexical：默认字面匹配，不下载模型，不发送文本。
- local：安装 cli/requirements.txt 后在本地 Python 环境运行真实句向量计算，首次使用需下载固定版本模型。
- remote：连接自有 embeddings API，需要显式选择、环境变量配置和 --allow-remote。

演示附带预先计算的句向量。自己的文本未接入模型时显示字面预览，不套用演示分数。相似度不能证明要求已经满足，需检查否定、数字和主体变化。

## 开发

```sh
npm ci
npm test
npm run lint
```

画布是原生 HTML/CSS/JavaScript，不需要网站框架、构建或云端账号。见[开发指南](docs/development.md)与[计算方法](docs/methodology.md)。

代码采用 [MIT 许可证](LICENSE)。演示文本由项目需求整理，方案为故意包含偏离的演示改写，不代表交付记录。不要把个人会话、凭据或未经授权的材料放进公开测试数据。

旧提交和历史分支仍可能包含拆分前的网站源码，本次没有改写 Git 历史。
