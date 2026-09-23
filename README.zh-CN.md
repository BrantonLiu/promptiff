# Promptiff · Agent 比对画布

[![English](https://img.shields.io/badge/README-English-2563eb?style=for-the-badge)](README.md)
[![简体中文](https://img.shields.io/badge/README-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-d1d5db?style=for-the-badge)](README.zh-CN.md)

把一轮或多轮用户 prompt 与选定的 AI 产出并排阅读，检查变化、遗漏和新增内容。支持语义比对、逐词比对、Git 比对、逐字比对，以及独立的原文预览；可查看 Markdown、纯文本、JSON、CSV、HTML 源码和代码。

本仓库提供独立的本地 CLI、画布和 Skill。自营网站、登录、反馈数据库及生产部署配置在独立仓库维护。

更名与已有安装的更新步骤见[切换到 Promptiff](docs/rename-promptiff.md)。

## 快速体验

需要 Node.js 22.13 或更高版本，基础功能无需安装 npm 依赖：

```sh
git clone https://github.com/BrantonLiu/promptiff.git
cd promptiff
node cli/promptiff.mjs serve --session examples/session.json
```

打开终端输出的完整本地链接。服务只监听 `127.0.0.1`；使用期间保持进程运行，按 Ctrl-C 关闭。在设置里可以导入会话 JSON，或粘贴自己的 prompt 和产出。

## 在 Agent 中使用

```sh
node cli/promptiff.mjs install --target ~/.agents/skills
node cli/promptiff.mjs capture --current --out /absolute/private/path/session.json
node cli/promptiff.mjs compare --session /absolute/private/path/session.json --out /absolute/private/path/report.json
node cli/promptiff.mjs serve --session /absolute/private/path/session.json
```

安装器不会覆盖已有 Skill。`capture` 仅从当前 Codex 任务环境采集数据；也可以手动准备 JSON。[Agent 接入说明](docs/agent-canvas.md)提供可复制给 Agent 的指令、数据格式和模型配置。当前交付 Skill 与 CLI，尚未上架公共插件市场。

希望每次交付文档都附带比对？将接入说明中的「文档交付约定」发给 Agent。它会保存实际正文，执行 `compare` 获取双向匹配，再启动画布并附上本机链接。安装 Skill 本身不等于全局自动执行；当前任务按约定运行，跨任务需配置项目规则。OpenClaw 等 Agent 可生成同一会话 JSON，不要求使用 Codex 日志。

## 计算方式

- **lexical**：默认使用字面匹配，不下载模型，也不发送文本。
- **local**：安装 `cli/requirements.txt` 后，在本地 Python 环境运行句向量比对；首次使用会下载固定版本的模型。
- **remote**：连接自有 embeddings API，需显式选择、配置环境变量并添加 `--allow-remote`。

演示附带预先计算的句向量。自己的文本未接入模型时显示字面预览，不会套用演示分数。相似度不能证明要求已经满足，还需检查否定、数字和主体变化。

## 开发

```sh
npm ci
npm test
npm run lint
```

画布使用原生 HTML、CSS 和 JavaScript，不需要网站框架、构建步骤或云端账号。见[开发指南](docs/development.md)与[计算方法](docs/methodology.md)。

代码采用 [MIT 许可证](LICENSE)。演示文本由项目需求整理，示例改写故意包含偏离，不代表交付记录。不要把个人会话、凭据或未经授权的材料放进公开测试数据。

旧提交和历史分支仍可能包含拆分前的网站源码。本仓库没有改写 Git 历史。
