import { sentences } from './core.mjs';

// An inert Markdown subset shared by preview and comparison. Raw HTML, images
// and links are text: importing a document never executes it or fetches a URL.
export function inlineTokens(text) {
  const tokens = [];
  const pattern =
    /(`+)([^`]+)\1|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|!?\[([^\]]+)\]\([^\n]*?\)/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > start)
      tokens.push({ text: text.slice(start, match.index) });
    tokens.push({
      text:
        match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7],
      tag: match[2]
        ? 'code'
        : match[3] || match[4]
          ? 'strong'
          : match[5] || match[6]
            ? 'em'
            : undefined,
    });
    start = match.index + match[0].length;
  }
  if (start < text.length) tokens.push({ text: text.slice(start) });
  return tokens;
}

function cells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((s) => s.trim().replace(/\\\|/g, '|'));
}
const divider = (line) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const fence = (line) => /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
const listItem = (line) => /^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/.exec(line);
const heading = (line) => /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
const rule = (line) => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);

function blocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const result = [];
  const special = (i) =>
    !lines[i]?.trim() ||
    fence(lines[i]) ||
    heading(lines[i]) ||
    listItem(lines[i]) ||
    rule(lines[i]) ||
    /^\s*>/.test(lines[i]) ||
    (lines[i].includes('|') && divider(lines[i + 1] || ''));
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const code = fence(line),
      title = heading(line),
      item = listItem(line);
    if (code) {
      const content = [];
      i++;
      while (
        i < lines.length &&
        !new RegExp(`^\\s*${code[1][0]}{${code[1].length},}\\s*$`).test(
          lines[i],
        )
      )
        content.push(lines[i++]);
      i++;
      result.push({
        type: 'code',
        text: content.join('\n'),
        language: code[2].trim(),
      });
    } else if (title) {
      result.push({ type: 'heading', level: title[1].length, text: title[2] });
      i++;
    } else if (rule(line)) {
      result.push({ type: 'rule' });
      i++;
    } else if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      result.push({ type: 'quote', children: blocks(quote.join('\n')) });
    } else if (line.includes('|') && divider(lines[i + 1] || '')) {
      const header = cells(line),
        rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|'))
        rows.push(cells(lines[i++]));
      result.push({ type: 'table', header, rows });
    } else if (item) {
      const ordered = !!item[2],
        children = [];
      while (i < lines.length) {
        const next = listItem(lines[i]);
        if (!next || !!next[2] !== ordered) break;
        let content = next[3];
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !special(i))
          content += `\n${lines[i++].trim()}`;
        children.push({ type: 'paragraph', text: content });
      }
      result.push({
        type: 'list',
        ordered,
        start: Number(item[2] || 1),
        children,
      });
    } else {
      const paragraph = [line];
      i++;
      while (i < lines.length && !special(i)) paragraph.push(lines[i++]);
      result.push({ type: 'paragraph', text: paragraph.join('\n') });
    }
  }
  return result;
}

export function prepareDocument(text, format = 'markdown') {
  if (format === 'json') {
    try {
      text = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      /* Preserve invalid JSON for inspection. */
    }
  }
  const tree =
    format === 'markdown'
      ? blocks(text)
      : format === 'text'
        ? text
            .split(/\n\s*\n/)
            .filter((s) => s.trim())
            .map((text) => ({ type: 'paragraph', text }))
        : [{ type: 'code', text }];
  const units = [];
  function content(node, compareContent = true, plain = false) {
    node.tokens =
      plain || format !== 'markdown'
        ? [{ text: node.text }]
        : inlineTokens(node.text);
    node.plain = node.tokens.map((token) => token.text).join('');
    node.units = [];
    let offset = 0;
    if (compareContent)
      for (const part of sentences(node.plain)) {
        const start = offset;
        offset += part.length;
        if (!part.trim()) continue;
        const unit = {
          index: units.length,
          text: part.trim(),
          start,
          end: offset,
        };
        node.units.push(unit);
        units.push(unit);
      }
  }
  function visit(node) {
    if (node.type === 'heading') content(node, false);
    else if (node.type === 'code') content(node, true, true);
    else if (node.type === 'paragraph') content(node);
    else if (node.type === 'table') {
      node.header = node.header.map((text) => {
        const cell = { text };
        content(cell, false);
        return cell;
      });
      node.rows = node.rows.map((row) =>
        row.map((text) => {
          const cell = { text };
          content(cell);
          return cell;
        }),
      );
    } else node.children?.forEach(visit);
  }
  tree.forEach(visit);
  return { blocks: tree, units };
}

export function renderDocument(container, document, decorate) {
  const dom = container.ownerDocument;
  function element(tag) {
    return dom.createElement(tag);
  }
  function appendTokens(parent, node, start = 0, end = node.plain.length) {
    let offset = 0;
    for (const token of node.tokens) {
      const from = Math.max(start - offset, 0),
        to = Math.min(end - offset, token.text.length);
      if (to > from) {
        const text = token.text.slice(from, to);
        if (token.tag) {
          const child = element(token.tag);
          child.textContent = text;
          parent.append(child);
        } else parent.append(dom.createTextNode(text));
      }
      offset += token.text.length;
    }
  }
  function content(parent, node) {
    if (!decorate || !node.units.length) {
      appendTokens(parent, node);
      return;
    }
    let offset = 0;
    for (const unit of node.units) {
      appendTokens(parent, node, offset, unit.start);
      const span = element('span');
      appendTokens(span, node, unit.start, unit.end);
      decorate(span, unit);
      parent.append(span);
      offset = unit.end;
    }
    appendTokens(parent, node, offset);
  }
  function render(node, parent) {
    if (node.type === 'rule') {
      parent.append(element('hr'));
      return;
    }
    if (node.type === 'table') {
      const wrap = element('div'),
        table = element('table'),
        head = element('thead'),
        header = element('tr'),
        body = element('tbody');
      wrap.className = 'table-wrap';
      node.header.forEach((cell) => {
        const th = element('th');
        content(th, cell);
        header.append(th);
      });
      head.append(header);
      node.rows.forEach((row) => {
        const tr = element('tr');
        row.forEach((cell) => {
          const td = element('td');
          content(td, cell);
          tr.append(td);
        });
        body.append(tr);
      });
      table.append(head, body);
      wrap.append(table);
      parent.append(wrap);
      return;
    }
    const tag =
      node.type === 'heading'
        ? `h${node.level}`
        : node.type === 'quote'
          ? 'blockquote'
          : node.type === 'list'
            ? node.ordered
              ? 'ol'
              : 'ul'
            : node.type === 'code'
              ? 'pre'
              : 'p';
    const block = element(tag);
    if (node.type === 'list') {
      if (node.ordered) block.start = node.start;
      node.children.forEach((child) => {
        const li = element('li');
        content(li, child);
        block.append(li);
      });
    } else if (node.children)
      node.children.forEach((child) => render(child, block));
    else content(block, node);
    parent.append(block);
  }
  document.blocks.forEach((node) => render(node, container));
}
