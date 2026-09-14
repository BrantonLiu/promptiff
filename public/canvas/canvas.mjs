import {
  sentences,
  validateSession,
  compare,
  diff,
  wordDiff,
  words,
} from './core.mjs';
const $ = (selector) => document.querySelector(selector);
import { demo, demoProvenance } from './demo.mjs';
import { prepareDocument, renderDocument } from './document.mjs';
import { demoVectors, demoModel } from './demo-vectors.mjs';
let sessions = [demo],
  sessionIndex = 0,
  artifactIndex = 1,
  selected = new Set(demo.turns.map((t) => t.id)),
  mode = 'semantic',
  threshold = 0.65,
  onlyGaps = false,
  active = -1,
  zoom = 1;
let capabilities = null,
  result = null,
  source = [],
  target = [],
  prepared = null,
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
  active = -1;
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
        active = -1;
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
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ text, turnId: t.id, label: t.label })),
    );
  prepared = prepareDocument(artifact().text, artifact().format);
  target = prepared.units.map((unit) => unit.text);
  vectors = null;
  result = null;
  if (!source.length) {
    render();
    return;
  }
  const texts = [...new Set([...source.map((s) => s.text), ...target])];
  if (mode === 'preview') {
    render();
    return;
  }
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
  if (
    mode === 'semantic' &&
    current() === demo &&
    !capabilities &&
    texts.every((text) => Object.hasOwn(demoVectors, text))
  )
    vectors = demoVectors;
  try {
    if (target.length) result = compare(source, target, vectors);
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
  return `rgba(${Math.round(235 - 81 * t)},${Math.round(192 + 6 * t)},${Math.round(114 + 37 * t)},${(0.19 + Math.abs(t - 0.5) * 0.25).toFixed(2)})`;
}
// Wrap text nodes without discarding Markdown emphasis, links or code formatting.
function decorateWords(node, reference) {
  const parts = wordDiff(reference, node.textContent)
    .filter((op) => op.type !== 'delete')
    .flatMap((op) => words(op.text).map((text) => ({ text, type: op.type })));
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  let index = 0,
    offset = 0;
  for (const textNode of textNodes) {
    const fragment = document.createDocumentFragment();
    let consumed = 0;
    while (consumed < textNode.textContent.length) {
      const part = parts[index];
      const length = Math.min(
        part.text.length - offset,
        textNode.textContent.length - consumed,
      );
      const mark = el(
        'span',
        textNode.textContent.slice(consumed, consumed + length),
        `word-unit word-${part.type}`,
      );
      mark.title =
        part.type === 'equal' ? '原位保留的词语' : '新增、替换或移位的词语';
      fragment.append(mark);
      consumed += length;
      offset += length;
      if (offset === part.text.length) {
        index++;
        offset = 0;
      }
    }
    textNode.replaceWith(fragment);
  }
}
function toggleDetails(open, focus = false) {
  $('#details').hidden = !open;
  $('#toggle-details').setAttribute('aria-expanded', String(open));
  if (open && focus) $('#close-details').focus();
}
function updateActive() {
  document.querySelectorAll('.sentence').forEach((node) => {
    const isActive = Number(node.dataset.index) === active;
    node.classList.toggle('active', isActive);
    node.setAttribute('aria-pressed', String(isActive));
  });
}
function render() {
  const isDemo = current() === demo;
  $('#paper-title').textContent = artifact().title;
  $('#format').textContent =
    artifact().format === 'markdown' ? 'MD' : artifact().format.toUpperCase();
  $('#demo-note').hidden = !isDemo;
  $('#demo-provenance').textContent = demoProvenance;
  $('#selected-count').textContent = `${selected.size} / ${eligible().length}`;
  $('#session-info').textContent =
    `${current().title} · ${current().turns.length} 轮 prompt · ${current().artifacts.length} 个产出物`;
  document
    .querySelectorAll('[data-mode]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode)),
    );
  const engineName =
    mode === 'preview'
      ? '原文'
      : mode === 'semantic'
        ? vectors
          ? isDemo && !capabilities
            ? '示例 · 语义已计算'
            : capabilities?.engine === 'remote'
              ? '远程语义'
              : '本地语义'
          : '字面预览 · 未接语义'
        : '字面比对';
  $('#engine-status').textContent = engineName;
  $('#engine-notice').textContent =
    isDemo && !capabilities
      ? `示例使用 ${demoModel.name} 预先计算的真实句向量，筛选时在浏览器内重新匹配。导入自己的文本后需接入本地模型或远程 API，否则使用字面预览。`
      : capabilities?.engine === 'remote'
        ? `使用已授权的远程 API：${capabilities.endpoint}。仅发送当前所选文本。`
        : capabilities?.engine === 'local'
          ? '使用本地句向量模型，文本保留在本机。'
          : '未接入语义模型，当前仅计算字面相似度。通过 Agent 接入配置本地模型或远程 API。';
  $('#threshold-value').textContent = threshold.toFixed(2);
  $('#counts').textContent =
    `${selected.size} 轮 prompt · ${target.length} 句产出`;
  $('#summary').replaceChildren();
  $('#only-gaps').disabled = mode === 'preview';
  $('#legend').hidden =
    mode === 'preview' || mode === 'diff' || mode === 'review';
  $('#legend').replaceChildren(
    ...(mode === 'lexical'
      ? [
          el('span', '原位保留', 'word-equal'),
          ' · ',
          el('span', '新增 / 替换 / 移位', 'word-insert'),
        ]
      : ['低匹配 ', el('b', undefined, 'gradient'), ' 高匹配']),
  );
  if (result && mode !== 'preview') {
    const mean =
      result.rows.reduce(
        (sum, row) => sum + row.candidates[0].score * row.text.length,
        0,
      ) / target.join('').length;
    for (const [label, value] of [
      [result.semantic ? '相似度' : '字面相似度', scoreText(mean)],
      [
        '需求对应',
        `${result.coverage.filter((s) => s.score >= threshold).length}/${source.length}`,
      ],
      [
        '低匹配',
        result.rows.filter((r) => r.candidates[0].score < threshold).length,
      ],
    ]) {
      const stat = el('div');
      stat.append(el('span', label), el('strong', String(value)));
      $('#summary').append(stat);
    }
  } else
    $('#summary').textContent =
      mode === 'preview'
        ? 'Markdown 阅读'
        : !source.length
          ? '未选择 prompt'
          : '没有可比对的正文';
  const output = $('#output');
  output.replaceChildren();
  output.classList.toggle('filtered', onlyGaps && mode !== 'preview');
  if (mode === 'preview' || (!result && source.length && !target.length))
    renderDocument(output, prepared);
  else if (!result)
    output.append(el('p', '选择至少一轮 prompt 开始比对。', 'empty'));
  else if (mode === 'diff' || mode === 'review') {
    for (const row of result.rows) {
      if (onlyGaps && row.candidates[0].score >= threshold) continue;
      const section = el('div', undefined, 'diff-row'),
        ref = source[row.candidates[0].index];
      section.append(el('small', `${ref.label} → 产出 ${row.index + 1}`));
      const ops = diff(ref.text, row.text);
      if (mode === 'diff') {
        const columns = el('div', undefined, 'diff-columns');
        for (const side of ['old', 'new']) {
          const column = el('div', undefined, `diff-${side}`);
          column.append(el('small', side === 'old' ? '− Prompt' : '+ 产出'));
          for (const op of ops) {
            if (op.type === (side === 'old' ? 'insert' : 'delete')) continue;
            column.append(
              el(
                op.type === 'equal' ? 'span' : side === 'old' ? 'del' : 'ins',
                op.text,
              ),
            );
          }
          columns.append(column);
        }
        section.append(columns);
      } else {
        for (const op of ops)
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
      }
      output.append(section);
    }
    if (!output.children.length)
      output.append(el('p', '当前阈值下没有低匹配产出。', 'empty'));
  } else {
    renderDocument(output, prepared, (node, unit) => {
      const row = result.rows[unit.index];
      node.className = 'sentence';
      node.dataset.index = String(row.index);
      node.setAttribute('role', 'button');
      node.tabIndex = 0;
      node.hidden = onlyGaps && row.candidates[0].score >= threshold;
      if (mode === 'lexical')
        decorateWords(node, source[row.candidates[0].index].text);
      else node.style.backgroundColor = heat(row.candidates[0].score);
      node.title = `${result.semantic ? '语义' : '字面'}相似度 ${scoreText(row.candidates[0].score)}`;
      function activate() {
        active = row.index;
        toggleDetails(true);
        updateActive();
        inspect();
      }
      node.addEventListener('click', activate);
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    });
    // Keep section titles as context while removing empty body blocks after filtering.
    if (onlyGaps) {
      output.querySelectorAll('p, li, pre, tr').forEach((node) => {
        const marks = [...node.querySelectorAll('.sentence')];
        if (marks.length && marks.every((mark) => mark.hidden))
          node.hidden = true;
      });
      if (result.rows.every((row) => row.candidates[0].score >= threshold))
        output.replaceChildren(el('p', '当前阈值下没有低匹配产出。', 'empty'));
    }
    updateActive();
  }
  inspect();
}
function inspect() {
  const box = $('#inspection');
  box.replaceChildren();
  $('#gaps').replaceChildren();
  const row = mode !== 'preview' && result?.rows[active];
  if (row) {
    box.append(
      el('div', result.semantic ? '语义相似度' : '字面相似度', 'detail-label'),
      el('div', scoreText(row.candidates[0].score), 'detail-score'),
      el('p', row.text, 'quote'),
      el('div', '对应的 prompt', 'detail-label'),
    );
    for (const match of row.candidates) {
      const ref = source[match.index],
        candidate = el('button', undefined, 'candidate');
      candidate.append(
        el('strong', `${ref.label} · ${scoreText(match.score)}`),
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
      el(
        'p',
        mode === 'preview'
          ? '切回比对视图后查看句子出处。'
          : '点选正文中的一句话。',
        'empty',
      ),
    );
  const gaps = result?.coverage.filter((s) => s.score < threshold) || [];
  $('#gap-count').textContent = result ? String(gaps.length) : '—';
  for (const ref of gaps) {
    const node = el('div', undefined, 'gap');
    node.append(
      el('small', `${ref.label} · ${scoreText(ref.score)}`),
      el('span', ref.text),
    );
    $('#gaps').append(node);
  }
  if (!gaps.length)
    $('#gaps').append(
      el(
        'p',
        result ? '当前阈值下没有低匹配要求。' : '选择 prompt 后显示。',
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
  $('#settings-dialog').close();
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
$('#paste').addEventListener('click', () => {
  $('#settings-dialog').close();
  $('#paste-dialog').showModal();
});
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
          format: 'markdown',
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
    `请给我安装 Wordiff ${kind === 'skill' ? 'Skill 和本地 CLI' : '本地 CLI'}，用于比对当前会话中的原始 prompt 与 AI 产出。\n仓库：https://github.com/BrantonLiu/wordiff\n先读取仓库 docs/agent-canvas.md 并确认包含 cli/wordiff.mjs；使用仓库 main 或用户提供的本地 checkout；如果缺少安装文件，请报告版本不符。把仓库放到我本地专用工具目录，保留已有文件。${kind === 'skill' ? '运行 node cli/wordiff.mjs install --target <此 Agent 的技能目录>；Codex 可使用 ~/.agents/skills。' : ''}\n只使用当前会话可见的用户 prompt 和我指定的 AI 产出，保留原文、轮次与出处；不要搜索其他对话，也不要包含系统提示、密钥或工具日志。Codex 可运行 capture --current；若不可用，由你按文档导出 session.json。\n计算方式：${engine === 'local' ? '本地语义。创建独立 Python 环境并安装 cli/requirements.txt，首次下载模型后在本地推理。' : engine === 'remote' ? '远程语义。请先向我获取 API 服务地址、模型名及上传许可；密钥通过环境变量配置，不写入会话文件。' : '本地字面比对，不安装模型。'}\n运行 node cli/wordiff.mjs serve --session <session.json> --engine ${engine}${engine === 'local' ? ' --python <虚拟环境中的python>' : ''}${engine === 'remote' ? ' --allow-remote' : ''}，保持服务进程存活，将返回的完整本地链接在 Agent 侧边浏览器或系统浏览器打开。告诉我哪些内容已采集、哪些因会话权限不可见。`;
}
function settingsTab(name) {
  for (const tab of document.querySelectorAll('[data-settings]')) {
    const enabled = tab.dataset.settings === name;
    tab.setAttribute('aria-selected', String(enabled));
    tab.tabIndex = enabled ? 0 : -1;
    document.getElementById(`settings-${tab.dataset.settings}`).hidden =
      !enabled;
  }
  installPrompt();
}
function openSettings(name = 'compare') {
  settingsTab(name);
  $('#settings-dialog').showModal();
}
$('#settings').addEventListener('click', () => openSettings());
$('#manage').addEventListener('click', () => openSettings('data'));
$('#engine-status').addEventListener('click', () => openSettings());
$('#configure-engine').addEventListener('click', () => {
  settingsTab('agent');
  $('#install-type').focus();
});
for (const tab of document.querySelectorAll('[data-settings]')) {
  tab.addEventListener('click', () => settingsTab(tab.dataset.settings));
  tab.addEventListener('keydown', (event) => {
    const names = ['compare', 'data', 'agent'];
    let index = names.indexOf(tab.dataset.settings);
    if (event.key === 'ArrowRight') index = (index + 1) % 3;
    else if (event.key === 'ArrowLeft') index = (index + 2) % 3;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = 2;
    else return;
    event.preventDefault();
    settingsTab(names[index]);
    $(`#tab-${names[index]}`).focus();
  });
}
$('#toggle-details').addEventListener('click', () =>
  toggleDetails($('#details').hidden, true),
);
$('#close-details').addEventListener('click', () => {
  toggleDetails(false);
  $('#toggle-details').focus();
});
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    !document.querySelector('dialog[open]') &&
    !$('#details').hidden
  ) {
    toggleDetails(false);
    const selectedSentence = document.querySelector(
      `.sentence[data-index="${active}"]`,
    );
    (selectedSentence || $('#toggle-details')).focus();
  }
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
        : '本地计算';
  } catch (e) {
    status(e.message);
  }
}
renderSelectors();
void recalculate();
