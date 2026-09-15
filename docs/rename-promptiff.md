# 切换到 Promptiff

项目由 Wordiff 更名为 Promptiff。CLI、Skill 与画布功能保持一致；会话 JSON 仍为 `version: 1`，已有导出可直接导入，用户原文不做替换。

## 更新工具

从 `https://github.com/BrantonLiu/promptiff` 获取新版。CLI 入口为 `node cli/promptiff.mjs`；`install`、`capture`、`serve` 子命令及参数不变。

Skill 更名为 `promptiff-canvas`。先把旧 `wordiff-canvas` 移到技能扫描目录之外备份，再运行 `node cli/promptiff.mjs install --target <技能目录>`。安装器仍拒绝覆盖已有同名技能，安装后的 `runtime/` 不依赖源仓库。

自有远程模型配置改用 `PROMPTIFF_API_URL`、`PROMPTIFF_API_KEY`、`PROMPTIFF_MODEL`，不再读取旧 `WORDIFF_` 前缀。只改变量名，沿用自己的值，不要把密钥写进命令参数或 Git。远程计算仍要求 `--engine remote --allow-remote`；默认字面比对仍完全本地且不需要 npm 依赖。

默认导出名改为 `promptiff-session.json`，导入不限制文件名。旧 CLI 文件名不再作为入口提供。

## 开发与验证

公共工具仍只维护一份共享画布；网站在独立私有仓库锁定本仓库的完整提交。

改名需通过 `npm test`、`npm run lint`、真实打包及独立安装验证，并检查画布四种比对、导入导出与 Agent 安装指令。演示标题不参与句向量计算，输入摘要及原向量匹配校验必须继续通过。
