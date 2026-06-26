import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');

const header = await read('./src/components/Header.astro');
const base = await read('./src/layouts/BaseLayout.astro');
const postLayout = await read('./src/layouts/BlogPostLayout.astro');
const blogIndex = await read('./src/pages/blog/index.astro');
const globalCss = await read('./src/styles/global.css');

test('global shell uses left profile sidebar instead of top navigation', () => {
  assert.match(header, /class="site-sidebar"/);
  assert.match(header, /\/images\/头像\.jpeg/);
  assert.match(header, /Jungrea/);
  assert.match(header, /代码与思考/);
  assert.match(header, /class="side-nav"/);
  assert.match(header, /class="sidebar-index"/);
  assert.match(header, /年份/);
  assert.match(header, /月份/);
  assert.match(header, /标签/);
  assert.doesNotMatch(header, /class="header"/);
  assert.match(base, /getCollection\('blog'\)/);
  assert.match(base, /globalSidebarIndex/);
  assert.match(header, /filterHref/);
  assert.match(header, /href=\{filterHref\('year', year\)\}/);
  assert.match(base, /class:list=\{\['site-shell'/);
  assert.match(base, /<slot name="right-sidebar" \/>/);
  assert.doesNotMatch(base, /margin-top: var\(--nav-height\)/);
});

test('layout expands desktop width and reserves left and right rails', () => {
  assert.match(globalCss, /--sidebar-width: 300px/);
  assert.match(globalCss, /--right-rail-width: 260px/);
  assert.match(base, /margin-left: var\(--sidebar-width\)/);
  assert.match(base, /grid-template-columns: minmax\(0, var\(--max-width\)\) var\(--right-rail-width\)/);
  assert.match(globalCss, /--max-width: 1040px/);
  assert.match(base, /gap: clamp\(1\.75rem, 2\.6vw, 2\.75rem\)/);
});

test('blog list and article pages use shared right rail widgets', async () => {
  const rightSidebar = await read('./src/components/RightSidebar.astro');
  assert.match(rightSidebar, /Recently Updated/);
  assert.match(rightSidebar, /Trending Tags/);
  assert.match(rightSidebar, /Contents/);
  assert.match(postLayout, /RightSidebar/);
  assert.match(postLayout, /slot="right-sidebar"/);
  assert.match(blogIndex, /RightSidebar/);
  assert.match(blogIndex, /slot="right-sidebar"/);
  assert.match(blogIndex, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(blogIndex, /syncFilterUrl/);
  assert.doesNotMatch(blogIndex, /class="filter-sidebar"/);
  assert.doesNotMatch(postLayout, /class="post-sidebar"/);
});
