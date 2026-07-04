import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const html = await fs.readFile(new URL('./public/index.html', import.meta.url), 'utf8');

test('article metadata lives in a top-right toolbar drawer instead of a fixed top panel', () => {
  const toolbarRightStart = html.indexOf('<div class="toolbar-right">');
  const headerEnd = html.indexOf('</header>', toolbarRightStart);
  const toolbarRightHtml = html.slice(toolbarRightStart, headerEnd);

  assert.ok(toolbarRightStart > -1, 'toolbar-right should exist');
  assert.match(toolbarRightHtml, /class="info-drawer"/);
  assert.match(toolbarRightHtml, /文章基础信息/);
  assert.doesNotMatch(html, /<section class="meta-panel">/);
});

test('article metadata drawer closes cleanly without focus-within sticking', () => {
  assert.doesNotMatch(html, /\.info-drawer:focus-within/);
  assert.match(html, /function closeInfoDrawer/);
  assert.match(html, /document\.addEventListener\('click'/);
});

test('editor supports autosave status and debounce function', () => {
  assert.match(html, /id="autoSaveStatus"/);
  assert.match(html, /AUTO_SAVE_DELAY/);
  assert.match(html, /function scheduleAutoSave/);
  assert.match(html, /function autoSave/);
});

test('theme selector keeps only reference themes 1, 3, and 6', () => {
  assert.match(html, /id="themeSelect"/);
  assert.match(html, /value="light"/);
  assert.match(html, /value="github-dark"/);
  assert.match(html, /value="dracula"/);
  assert.doesNotMatch(html, /value="dark-plus"/);
  assert.doesNotMatch(html, /value="one-dark"/);
  assert.doesNotMatch(html, /value="nord"/);
  assert.match(html, /function setTheme/);
});

test('markdown preview uses themed rendering styles', () => {
  assert.match(html, /--h1-color/);
  assert.match(html, /--code-bg/);
  assert.match(html, /--blockquote-bg/);
  assert.match(html, /\.preview h1::before/);
  assert.match(html, /\.code-block/);
  assert.match(html, /function enhanceCodeBlocks/);
});

test('light theme keeps pane titles and tags readable', () => {
  assert.match(html, /\.pane-title \{[\s\S]*background: var\(--surface-subtle\)/);
  assert.match(html, /\.pane-title \{[\s\S]*color: var\(--text\)/);
  assert.match(html, /\.tag \{[\s\S]*color: var\(--primary-strong\)/);
  assert.doesNotMatch(html, /\.tag \{[^}]*#bfdbfe/);
  assert.doesNotMatch(html, /\.pane-title \{[^}]*rgba\(15, 23, 42, 0\.52\)/);
});

test('floating panels are readable in light theme', () => {
  assert.match(html, /\.info-panel \{[\s\S]*background: var\(--surface-solid\)/);
  assert.match(html, /\.box \{[\s\S]*background: var\(--surface-solid\)/);
  assert.match(html, /\.log \{[\s\S]*color: var\(--text\)/);
  assert.match(html, /\.log \{[\s\S]*background: var\(--surface-subtle\)/);
  assert.doesNotMatch(html, /\.info-panel \{[^}]*rgba\(2, 6, 23, 0\.94\)/);
  assert.doesNotMatch(html, /\.box \{[^}]*rgba\(2, 6, 23, 0\.9\)/);
  assert.doesNotMatch(html, /\.log \{[^}]*#cbd5e1/);
});

test('sidebar supports year and month filtering by pubDate', () => {
  assert.match(html, /id="yearFilters"/);
  assert.match(html, /id="monthFilters"/);
  assert.match(html, /function buildDateFilters/);
  assert.match(html, /function toggleDateFilter/);
  assert.match(html, /activeFilterType/);
  assert.match(html, /post\.meta\.pubDate/);
});

test('article file can be renamed from title or slug explicitly without stretching toolbar', () => {
  assert.match(html, /id="renamePostBtn"/);
  assert.match(html, /function renameCurrentPost/);
  assert.match(html, /\/api\/post\/rename/);
  assert.match(html, /\.toolbar-left, \.toolbar-right \{[\s\S]*flex-wrap: nowrap/);
  assert.match(html, /\.status \{[\s\S]*text-overflow: ellipsis/);
  assert.match(html, /closeInfoDrawer\(\);[\s\S]*setStatus\('已重命名'/);
});

test('single-pane edit and preview modes use full-width workspace', () => {
  assert.match(html, /body\.preview-only \.workspace \{ grid-template-columns: 1fr; \}/);
  assert.match(html, /body\.edit-only \.workspace \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(html, /body\.preview-only \.workspace \{ grid-template-columns: 0 1fr; \}/);
  assert.doesNotMatch(html, /body\.edit-only \.workspace \{ grid-template-columns: 1fr 0; \}/);
});

test('sidebar can collapse to a narrow left rail and remember state', () => {
  assert.match(html, /id="sidebarCollapseBtn"/);
  assert.match(html, /class="sidebar-collapse-toggle"/);
  assert.match(html, /body\.sidebar-collapsed \.app \{ grid-template-columns: 22px 1fr; \}/);
  assert.match(html, /SIDEBAR_COLLAPSED_KEY/);
  assert.match(html, /function setSidebarCollapsed/);
  assert.match(html, /localStorage\.setItem\(SIDEBAR_COLLAPSED_KEY/);
  assert.match(html, /sidebarCollapseIcon/);
  assert.match(html, /classList\.contains\('sidebar-collapsed'\)/);
});

test('editor supports inserting uploaded or existing images', () => {
  assert.match(html, /id="imageToggle"/);
  assert.match(html, /id="imagePanel"/);
  assert.match(html, /id="imageUploadBtn"/);
  assert.match(html, /id="imageGrid"/);
  assert.match(html, /function loadImages/);
  assert.match(html, /function insertImageMarkdown/);
  assert.match(html, /\/api\/images/);
  assert.match(html, /\/api\/image/);
});

test('markdown editor exposes a syntax shortcut toolbar', () => {
  assert.match(html, /id="markdownToolbar"/);
  assert.match(html, /data-md-action="bold"/);
  assert.match(html, /data-md-action="h1"/);
  assert.match(html, /data-md-action="unordered-list"/);
  assert.match(html, /data-md-action="code-block"/);
  assert.match(html, /function applyMarkdownAction/);
  assert.match(html, /function wrapSelection/);
  assert.match(html, /function replaceSelectedLines/);
});

test('image picker keeps search above grid and shows newest images first', () => {
  assert.match(html, /\.image-panel \{[\s\S]*grid-template-rows: auto auto auto minmax\(0, 1fr\)/);
  assert.match(html, /\.image-grid \{[\s\S]*align-content: start/);
});

test('preview pane has a collapsible table of contents drawer', () => {
  assert.match(html, /id="tocDrawer"/);
  assert.match(html, /id="tocToggle"/);
  assert.match(html, /id="tocList"/);
  assert.match(html, /function buildPreviewToc/);
  assert.match(html, /function updateActiveToc/);
  assert.match(html, /\.toc-drawer\.open/);
});

test('editor can render and copy current markdown through same-origin md2wx HTML output', () => {
  assert.match(html, /id="wxRenderBtn"/);
  assert.match(html, /渲染微信/);
  assert.match(html, /id="wxPanel"/);
  assert.match(html, /id="wxFrame"/);
  assert.match(html, /id="wxCopyBtn"/);
  assert.match(html, /一键复制到公号/);
  assert.match(html, /id="wxCopyStatus"/);
  assert.match(html, /复制中/);
  assert.match(html, /复制成功，可以去公众号粘贴/);
  assert.match(html, /function openWxPanel/);
  assert.match(html, /function syncWxMarkdown/);
  assert.match(html, /md2wx:setMarkdown/);
  assert.match(html, /buildInlineHTML\(\)/);
  assert.match(html, /new ClipboardItem/);
  assert.match(html, /'text\/html'/);
  assert.match(html, /'text\/plain'/);
  assert.match(html, /id="toast"/);
  assert.match(html, /function showToast/);
  assert.match(html, /showToast\('已复制微信公众号排版内容'/);
  assert.doesNotMatch(html, /md2wx:copy/);
});

test('split view keeps linked scrolling always enabled without toolbar toggle', () => {
  assert.doesNotMatch(html, /id="syncScrollBtn"/);
  assert.match(html, /function syncScroll/);
  assert.match(html, /syncScrollEnabled: true/);
  assert.doesNotMatch(html, /function toggleSyncScroll/);
});
