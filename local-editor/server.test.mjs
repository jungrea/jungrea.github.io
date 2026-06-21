import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const server = await fs.readFile(new URL('./server.mjs', import.meta.url), 'utf8');
const md2wx = await fs.readFile(new URL('./md2wx.html', import.meta.url), 'utf8');

test('md2wx template is project-local and not loaded from an absolute sibling path', () => {
  assert.match(server, /path\.join\(__dirname, 'md2wx\.html'\)/);
  assert.doesNotMatch(server, /\.\.\/md2wx\/md2wx\.html/);
  assert.match(md2wx, /function buildInlineHTML\(\)/);
});

test('md2wx copy output does not add an outer article background wrapper', () => {
  assert.doesNotMatch(server, /preserveWxBackground/);
  assert.doesNotMatch(server, /background:#fcfcfc/);
  assert.doesNotMatch(md2wx, /<section style="\$\{theme\.article_card\}">/);
  assert.match(md2wx, /side_indent:\s*'margin-left:8px;margin-right:8px;'/);
});
