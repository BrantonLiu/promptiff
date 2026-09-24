# 案例：一份方案悄悄改了“留在本地”的要求

这里使用仓库内[刻意编写的公开样本](../examples/session.json)，不是用户的私人会话，也不是真实交付记录。我们用它演示：怎样按每版产出生成时已有的要求，检查 Agent 的方案。

## 1. 运行样本

在仓库根目录，用 Node.js 22.13 或更高版本运行：

```sh
node cli/promptiff.mjs compare --session examples/session.json --artifact a1 --out /tmp/promptiff-a1.json
node cli/promptiff.mjs compare --session examples/session.json --artifact a2 --out /tmp/promptiff-a2.json
node cli/promptiff.mjs serve --session examples/session.json
```

打开 `serve` 输出的完整本地链接，在画布中切换初版和迭代版，从“要求找产出”和“产出找要求”两个方向检查。默认使用字面比对，不向模型发送文本。若设备没有 `/tmp`，把输出路径改为本机可写的位置。

## 2. 对读要求与方案

第一轮要求说：本地算力足够时，数据和计算都留在本地；算力不足时可以选择远程 API。初版方案 `a1` 却写成“统一将全部会话上传到平台计算”，还增加登录、默认保存历史会话和每周向团队发报告。这改变了数据边界。段落标题同样叫“计算与保存”，不代表要求已经满足。

第二版 `a2` 恢复了本地流程，但又加入团队活跃度排行榜和自动发送的周报；原始要求没有提出这两项。交付前应先确认，尤其因为它们会涉及其他人的使用数据。

Promptiff 的反向视图帮助找到缺少对应内容的原始要求，正向视图帮助找到来源不清的新增内容。字面分数低只是**提示检查**，不能自动判定遗漏或错误。仍要亲自核对否定词、条件、数字和主语。

样本有两轮要求。`a1` 只与生成它之前的要求比对；`a2` 与此前两轮比对。后来的要求不会被算作早期方案的遗漏。

## 3. 换成自己的任务

可以在[网页画布](https://promptiff.zliu2934.workers.dev/canvas)粘贴原始要求和选定产出，或把 [README 的安装指令](../README.zh-CN.md#一键复制给-agent-使用)发给 Agent。网页画布把粘贴文本保留在当前页面内存中；本地 CLI 在自己的设备运行。远程向量服务需要明确选择和上传授权。

Promptiff 帮你定位需要读的段落，不保证产出正确或完整。
