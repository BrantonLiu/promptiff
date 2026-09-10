import { sentences, validateSession, compare, diff } from './core.mjs';
const $ = (selector) => document.querySelector(selector);
const demo = validateSession({
  version: 1,
  title: '示例 · 为团队设计一个任务助手',
  turns: [
    {
      id: 't1',
      label: '01 · 最初的想法',
      text: '做一个团队任务助手，让员工用一句话创建待办。所有任务默认只保存在本地，不上传到服务器。',
    },
    {
      id: 't2',
      label: '02 · 补充边界',
      text: '支持按负责人筛选任务。不要加入排行榜，也不要发送提醒邮件。',
    },
    {
      id: 't3',
      label: '03 · 调整交付',
      text: '先给我一个网页原型，界面要简洁。保留导出 CSV 的能力。',
    },
  ],
  artifacts: [
    {
      id: 'a1',
      title: '第一版 · 产品方案.md',
      turnId: 't2',
      format: 'markdown',
      text: '# 团队任务助手\n\n员工输入一句话即可创建待办。\n所有任务默认保存到云端，方便团队同步。\n支持按照任务负责人筛选。\n系统每天发送邮件，提醒成员完成任务。',
    },
    {
      id: 'a2',
      title: '最终版 · 实施方案.md',
      turnId: 't3',
      format: 'markdown',
      text: '# 让任务回到工作本身\n\n员工用一句自然语言描述，即可创建待办。\n任务仅保存在当前设备，不会上传服务器。\n按负责人筛选，快速找到相关任务。\n先交付一个简洁的网页原型。\n支持将任务导出为 CSV 文件。\n团队每周可查看效率排行榜。',
    },
  ],
});
let sessions = [demo],
  sessionIndex = 0,
  artifactIndex = 1,
  selected = new Set(demo.turns.map((t) => t.id)),
  mode = 'semantic',
  threshold = 0.65,
  onlyGaps = false,
  active = 0,
  zoom = 1;
let capabilities = null,
  result = null,
  source = [],
  target = [],
  vectors = null,
  calculation = 0;
const cache = new Map();
let statusTimer;
function status(text) {
  $('#status').textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => ($('#status').textContent = ''), 6000);
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function current() {
  return sessions[sessionIndex];
}
function artifact() {
  return current().artifacts[artifactIndex];
}
function eligible() {
  return current().turns.slice(
    0,
    current().turns.findIndex((t) => t.id === artifact().turnId) + 1,
  );
}
function resetSelection() {
  selected = new Set(eligible().map((t) => t.id));
  active = 0;
  vectors = null;
}
function renderSelectors() {
  $('#sessions').replaceChildren(
    ...sessions.map((s, i) => new Option(s.title, String(i))),
  );
  $('#sessions').value = String(sessionIndex);
  $('#artifacts').replaceChildren(
    ...current().artifacts.map((a, i) => new Option(a.title, String(i))),
  );
  $('#artifacts').value = String(artifactIndex);
  const allowed = new Set(eligible().map((t) => t.id));
  $('#turns').replaceChildren(
    ...current().turns.map((turn) => {
      const label = el('label', undefined, 'turn'),
        head = el('span', undefined, 'turn-heading'),
        input = el('input');
      input.type = 'checkbox';
      input.checked = selected.has(turn.id);
      input.disabled = !allowed.has(turn.id);
      input.addEventListener('change', () => {
        if (input.checked) selected.add(turn.id);
        else selected.delete(turn.id);
        active = 0;
        void recalculate();
      });
      head.append(
        input,
        el('span', turn.label + (input.disabled ? ' · 晚于此产出' : '')),
      );
      label.append(head, el('p', turn.text));
      return label;
    }),
  );
}
async function recalculate() {
  const revision = ++calculation;
  source = eligible()
    .filter((t) => selected.has(t.id))
    .flatMap((t) =>
      sentences(t.text)
        .filter((s) => s.trim())
        .map((text) => ({ text, turnId: t.id, label: t.label })),
    );
  target = sentences(artifact().text).filter((s) => s.trim());
  vectors = null;
  result = null;
  if (!source.length) {
    render();
    return;
  }
  const texts = [...new Set([...source.map((s) => s.text), ...target])];
  // No network request is made by the hosted canvas. A token identifies the local CLI only.
  if (
    mode === 'semantic' &&
    capabilities?.engine &&
    capabilities.engine !== 'lexical'
  ) {
    const key = JSON.stringify(texts);
    if (cache.has(key)) vectors = cache.get(key);
    else {
      $('#engine-notice').textContent =
        capabilities.engine === 'local'
          ? '本地模型正在计算句向量…'
          : '正在将所选文本发送至已配置的远程 API…';
      $('#output').replaceChildren(el('p', '正在计算当前筛选条件…', 'empty'));
      try {
        const response = await fetch('/api/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ texts }),
        });
        if (!response.ok) {
          const info = await response.json();
          throw new Error(info.error || '计算失败');
        }
        const data = await response.json();
        if (revision !== calculation) return;
        vectors = Object.fromEntries(
          texts.map((text, i) => [text, data.vectors[i]]),
        );
        // Validate complete returned vectors before caching.
        compare(source, target, vectors);
        cache.clear();
        cache.set(key, vectors);
      } catch (error) {
        if (revision !== calculation) return;
        status(`语义计算失败：${error.message}`);
        vectors = null;
      }
    }
  }
  try {
    result = compare(source, target, vectors);
  } catch (error) {
    status(error.message);
  }
  render();
}
function scoreText(n) {
  return n.toFixed(2);
}
function heat(score) {
  const t = Math.max(0, Math.min(1, score));
  return `rgb(${Math.round(248 - 64 * t)},${Math.round(221 - 1 * t)},${Math.round(153 + 57 * t)})`;
}
function render() {
  $('#paper-title').textContent = artifact().title;
  $('#format').textContent = artifact().format.toUpperCase();
  document
    .querySelectorAll('[data-mode]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode)),
    );
  $('#engine-notice').textContent =
    mode === 'semantic' && !vectors
      ? '当前为字面匹配预览。接入本地模型或远程 API 后才会显示真实语义分数。'
      : vectors
        ? '真实句向量余弦相似度 · 表达接近不代表满足要求。'
        : '';
  $('#threshold-value').textContent = threshold.toFixed(2);
  $('#counts').textContent =
    `${selected.size} 轮 prompt · ${target.length} 句产出`;
  $('#summary').replaceChildren();
  if (result) {
    const mean =
      result.rows.reduce(
        (sum, row) => sum + row.candidates[0].score * row.text.length,
        0,
      ) / target.join('').length;
    for (const [label, value] of [
      [result.semantic ? '平均语义相似度' : '平均字面相似度', scoreText(mean)],
      [
        '原意覆盖',
        `${result.coverage.filter((s) => s.score >= threshold).length} / ${source.length}`,
      ],
      [
        '低匹配产出',
        result.rows.filter((r) => r.candidates[0].score < threshold).length,
      ],
    ]) {
      const stat = el('div');
      stat.append(el('strong', String(value)), el('span', label));
      $('#summary').append(stat);
    }
  }
  if (
    onlyGaps &&
    result &&
    result.rows[active]?.candidates[0].score >= threshold
  )
    active = result.rows.findIndex(
      (row) => row.candidates[0].score < threshold,
    );
  const output = $('#output');
  output.replaceChildren();
  if (mode === 'preview') preview(output, artifact());
  else if (!result)
    output.append(
      el(
        'p',
        '选择至少一轮 prompt 开始比对。若文本过长，请减少轮次。',
        'empty',
      ),
    );
  else if (mode === 'diff') {
    output.append(
      el(
        'p',
        '按字面最近句配对，再显示字符修订。配对不代表语义归因；未对应的 prompt 见右侧。',
        'subtle',
      ),
    );
    for (const row of result.rows) {
      if (onlyGaps && row.candidates[0].score >= threshold) continue;
      const section = el('div', undefined, 'diff-row'),
        ref = source[row.candidates[0].index];
      section.append(el('small', `${ref.label} → 产出 ${row.index + 1}`));
      for (const op of diff(ref.text, row.text))
        section.append(
          el(
            op.type === 'delete'
              ? 'del'
              : op.type === 'insert'
                ? 'ins'
                : 'span',
            op.text,
          ),
        );
      output.append(section);
    }
  } else {
    let visible = 0;
    for (const row of result.rows) {
      if (onlyGaps && row.candidates[0].score >= threshold) continue;
      const node = el(
        'button',
        row.text,
        'sentence' + (active === row.index ? ' active' : ''),
      );
      node.style.background = heat(row.candidates[0].score);
      node.title = `${result.semantic ? '语义' : '字面'}相似度 ${scoreText(row.candidates[0].score)}`;
      node.setAttribute('aria-pressed', String(active === row.index));
      node.addEventListener('click', () => {
        active = row.index;
        render();
      });
      output.append(node);
      visible++;
    }
    if (!visible) output.append(el('p', '当前阈值下没有低匹配产出。', 'empty'));
  }
  inspect();
}
function preview(output, item) {
  if (item.format === 'json') {
    try {
      output.append(el('pre', JSON.stringify(JSON.parse(item.text), null, 2)));
    } catch {
      output.append(el('pre', item.text));
    }
    return;
  }
  if (item.format === 'markdown') {
    // Deliberately small, inert Markdown preview: headings, paragraphs, fenced code.
    let inCode = false,
      code = [];
    for (const line of item.text.split('\n')) {
      if (line.startsWith('```')) {
        if (inCode) {
          output.append(el('pre', code.join('\n')));
          code = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      output.append(
        el(match ? `h${match[1].length}` : 'p', match ? match[2] : line),
      );
    }
    if (code.length) output.append(el('pre', code.join('\n')));
    return;
  }
  // HTML/code remains inert source, never executes or fetches embedded URLs.
  output.append(el('pre', item.text));
}
function inspect() {
  const box = $('#inspection');
  box.replaceChildren();
  $('#gaps').replaceChildren();
  const row = result?.rows[active];
  if (row) {
    box.append(
      el(
        'div',
        result.semantic ? '语义相似度 · cosine' : '字面相似度 · Dice',
        'detail-label',
      ),
      el('div', scoreText(row.candidates[0].score), 'detail-score'),
      el('p', row.text, 'quote'),
      el('div', '最接近的 prompt 句子', 'detail-label'),
    );
    for (const match of row.candidates) {
      const ref = source[match.index],
        candidate = el('button', undefined, 'candidate');
      candidate.append(
        el('strong', `${scoreText(match.score)} · ${ref.label}`),
        el('span', ref.text),
      );
      candidate.addEventListener('click', () => {
        document.querySelectorAll('.turn').forEach((node, i) => {
          if (current().turns[i].id === ref.turnId) {
            node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            node.querySelector('input').focus({ preventScroll: true });
          }
        });
      });
      box.append(candidate);
    }
  } else
    box.append(
      el('p', '点击产出中的一句话，查看它与所选 prompt 的对应关系。', 'empty'),
    );
  const gaps = result?.coverage.filter((s) => s.score < threshold) || [];
  $('#gap-count').textContent = String(gaps.length);
  for (const ref of gaps) {
    const node = el('div', undefined, 'gap');
    node.append(
      el('small', `${ref.label} · 最佳匹配 ${scoreText(ref.score)}`),
      el('span', ref.text),
    );
    $('#gaps').append(node);
  }
  if (!gaps.length)
    $('#gaps').append(
      el(
        'p',
        result
          ? '当前阈值下没有低匹配要求；这不保证要求已被正确执行。'
          : '选择 prompt 后显示。',
        'subtle',
      ),
    );
}
function addSession(value) {
  const parsed = validateSession(value);
  sessions.push(parsed);
  sessionIndex = sessions.length - 1;
  artifactIndex = parsed.artifacts.length - 1;
  resetSelection();
  renderSelectors();
  void recalculate();
}
$('#sessions').addEventListener('change', () => {
  sessionIndex = Number($('#sessions').value);
  artifactIndex = current().artifacts.length - 1;
  resetSelection();
  renderSelectors();
  void recalculate();
});
$('#artifacts').addEventListener('change', () => {
  artifactIndex = Number($('#artifacts').value);
  resetSelection();
  renderSelectors();
  void recalculate();
});
$('#all').addEventListener('click', () => {
  selected = new Set(eligible().map((t) => t.id));
  renderSelectors();
  void recalculate();
});
$('#only-gaps').addEventListener('change', () => {
  onlyGaps = $('#only-gaps').checked;
  render();
});
$('#threshold').addEventListener('input', () => {
  threshold = Number($('#threshold').value);
  render();
});
for (const node of document.querySelectorAll('[data-mode]'))
  node.addEventListener('click', () => {
    mode = node.dataset.mode;
    void recalculate();
  });
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async () => {
  try {
    const file = $('#file').files[0];
    if (!file) return;
    if (file.size > 1000000) throw new Error('会话文件最多 1 MB。');
    addSession(JSON.parse(await file.text()));
  } catch (e) {
    status(e.message);
  } finally {
    $('#file').value = '';
  }
});
$('#upload-artifact').addEventListener('click', () =>
  $('#artifact-file').click(),
);
$('#artifact-file').addEventListener('change', async () => {
  try {
    const file = $('#artifact-file').files[0];
    if (!file) return;
    if (file.size > 240000)
      throw new Error('文本产出物过大，请先截取相关部分。');
    const ext = file.name.split('.').at(-1);
    const format =
      { md: 'markdown', txt: 'text', json: 'json', csv: 'csv', html: 'html' }[
        ext
      ] || 'code';
    const value = {
      ...current(),
      artifacts: [
        ...current().artifacts,
        {
          id: crypto.randomUUID(),
          title: file.name,
          turnId: artifact().turnId,
          text: await file.text(),
          format,
        },
      ],
    };
    sessions[sessionIndex] = validateSession(value);
    artifactIndex = value.artifacts.length - 1;
    resetSelection();
    renderSelectors();
    void recalculate();
  } catch (e) {
    status(e.message);
  } finally {
    $('#artifact-file').value = '';
  }
});
$('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(current(), null, 2)], {
      type: 'application/json',
    }),
  );
  const link = el('a');
  link.href = url;
  link.download = 'wordiff-session.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#paste').addEventListener('click', () => $('#paste-dialog').showModal());
$('#paste-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    addSession({
      version: 1,
      title: '粘贴的比对',
      turns: [
        { id: 't1', label: '01 · 我的 prompt', text: $('#prompt-text').value },
      ],
      artifacts: [
        {
          id: 'a1',
          title: 'AI 产出',
          text: $('#result-text').value,
          turnId: 't1',
          format: 'text',
        },
      ],
    });
    $('#paste-dialog').close();
  } catch (e) {
    status(e.message);
  }
});
for (const node of document.querySelectorAll('[data-close]'))
  node.addEventListener('click', () =>
    document.getElementById(node.dataset.close).close(),
  );
function installPrompt() {
  const kind = $('#install-type').value,
    engine = $('#compute').value;
  $('#install-prompt').value =
    `请给我安装 Wordiff ${kind === 'skill' ? 'Skill 和本地 CLI' : '本地 CLI'}，用于比对当前会话中的原始 prompt 与 AI 产出。\n仓库：https://github.com/BrantonLiu/wordiff\n先读取仓库 docs/agent-canvas.md 并确认包含 cli/wordiff.mjs；开发版使用 codex/agent-canvas 分支或用户提供的本地 checkout。若远端没有该分支，请报告尚未发布，不要假装安装成功。把仓库放到我本地专用工具目录，保留已有文件。${kind === 'skill' ? '运行 node cli/wordiff.mjs install --target <此 Agent 的技能目录>；Codex 可使用 ~/.agents/skills。' : ''}\n只使用当前会话可见的用户 prompt 和我指定的 AI 产出，保留原文、轮次与出处；不要搜索其他对话，也不要包含系统提示、密钥或工具日志。Codex 可运行 capture --current；若不可用，由你按文档导出 session.json。\n计算方式：${engine === 'local' ? '本地语义。创建独立 Python 环境并安装 cli/requirements.txt，首次下载模型后在本地推理。' : engine === 'remote' ? '远程语义。请先向我获取 API 服务地址、模型名及上传许可；密钥通过环境变量配置，不写入会话文件。' : '本地字面比对，不安装模型。'}\n运行 node cli/wordiff.mjs serve --session <session.json> --engine ${engine}${engine === 'local' ? ' --python <虚拟环境中的python>' : ''}${engine === 'remote' ? ' --allow-remote' : ''}，保持服务进程存活，将返回的完整本地链接在 Agent 侧边浏览器或系统浏览器打开。告诉我哪些内容已采集、哪些因会话权限不可见。`;
}
$('#install').addEventListener('click', () => {
  installPrompt();
  $('#install-dialog').showModal();
});
$('#install-type').addEventListener('change', installPrompt);
$('#compute').addEventListener('change', installPrompt);
$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#install-prompt').value);
    status('已复制，粘贴给你的 Agent 即可。');
  } catch {
    $('#install-prompt').select();
    status('请手动复制已选中的安装指令。');
  }
});
function setZoom(value) {
  zoom = Math.max(0.6, Math.min(1.6, value));
  $('.paper').style.zoom = zoom;
  $('#zoom').textContent = `${Math.round(zoom * 100)}%`;
}
$('#zoom-in').addEventListener('click', () => setZoom(zoom + 0.1));
$('#zoom-out').addEventListener('click', () => setZoom(zoom - 0.1));
$('#reset').addEventListener('click', () => {
  setZoom(1);
  $('#viewport').scrollTo(0, 0);
});
let drag = null;
$('#viewport').addEventListener('pointerdown', (e) => {
  if (e.target.closest('.paper') || e.button !== 0) return;
  drag = {
    x: e.clientX,
    y: e.clientY,
    left: $('#viewport').scrollLeft,
    top: $('#viewport').scrollTop,
  };
  $('#viewport').setPointerCapture(e.pointerId);
  $('#viewport').classList.add('dragging');
});
$('#viewport').addEventListener('pointermove', (e) => {
  if (drag) {
    $('#viewport').scrollLeft = drag.left - e.clientX + drag.x;
    $('#viewport').scrollTop = drag.top - e.clientY + drag.y;
  }
});
for (const event of ['pointerup', 'pointercancel'])
  $('#viewport').addEventListener(event, () => {
    drag = null;
    $('#viewport').classList.remove('dragging');
  });
const token = new URLSearchParams(location.hash.slice(1)).get('token');
if (token) {
  $('.brand').href = location.href;
  $('.source-foot a').hidden = true;
  try {
    const response = await fetch('/api/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
      throw new Error('本地会话加载失败，请使用 CLI 返回的完整链接。');
    const data = await response.json();
    capabilities = data.capabilities;
    sessions = data.sessions.map(validateSession);
    sessionIndex = 0;
    artifactIndex = current().artifacts.length - 1;
    resetSelection();
    $('#privacy').textContent =
      capabilities.engine === 'remote'
        ? `远程计算 · ${capabilities.endpoint}`
        : '本地进程 · 文本保留在本机';
  } catch (e) {
    status(e.message);
  }
}
renderSelectors();
void recalculate();
