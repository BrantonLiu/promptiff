# 开发指南

| 路径 | 用途 |
| --- | --- |
| cli/promptiff.mjs | CLI、Skill 安装器、loopback 服务 |
| cli/session.mjs | 当前任务日志适配与 JSON 读取 |
| cli/engine.mjs、embeddings.py | 本地与自有远程句向量 |
| public/canvas/ | 静态画布、算法、Markdown 渲染和演示 |
| skills/promptiff-canvas/ | Agent 操作说明 |
| examples/session.json | 独立体验样本 |
| tests/ | 算法、渲染、API 和安装器测试 |
| scripts/build-canvas-demo.mjs | 重算演示向量 |

Node.js 22.13+。无需安装依赖即可运行：

```sh
node cli/promptiff.mjs serve --session examples/session.json
```

开发检查：

```sh
npm ci
npm test
npm run lint
npm pack --dry-run
```

画布直接提供源码资源，无 TypeScript 或网站构建步骤。package.json 的 private 防止误发布 npm，Git 仓库本身公开。打包清单包含运行工具所需文件与文档。

重算演示时创建 Python 环境并安装 cli/requirements.txt，执行 node scripts/build-canvas-demo.mjs .venv/bin/python。已有模型缓存可设置 HF_HUB_OFFLINE=1。只处理 demo.mjs 中整理后的文本，测试核对文本摘要；不得编造相似度。

网站在独立仓库中通过 package-lock 锁定本仓库的 Git 提交，构建前复制依赖里的 public/canvas。共享画布只在这里修改。网站嵌入 /canvas/index.html，CLI 在自己的 loopback origin 提供相同文件和本地 API。画布保留原生 / 首页链接。
