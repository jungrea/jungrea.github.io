import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  buildMarkdown,
  createPostRelativePath,
  deletePost,
  listImageFiles,
  parseMarkdown,
  safePostPath,
  sortPostsNewestFirst,
  slugify,
} from './lib.mjs';

test('slugify keeps Chinese words and creates URL-safe separators', () => {
  assert.equal(slugify(' Hello，世界 / Astro 入门! '), 'hello-世界-astro-入门');
  assert.equal(slugify(''), 'untitled');
});

test('buildMarkdown and parseMarkdown round-trip Astro blog frontmatter', () => {
  const markdown = buildMarkdown({
    title: '一篇: 新文章',
    description: '网页写作测试',
    pubDate: '2026-06-21',
    updatedDate: '2026-06-22',
    tags: ['Astro', 'Markdown'],
  }, '# 正文\n\n内容');

  assert.match(markdown, /^---\n/);
  assert.match(markdown, /title: "一篇: 新文章"/);
  assert.match(markdown, /tags: \["Astro", "Markdown"\]/);

  const parsed = parseMarkdown(markdown);
  assert.deepEqual(parsed.meta, {
    title: '一篇: 新文章',
    description: '网页写作测试',
    pubDate: '2026-06-21',
    updatedDate: '2026-06-22',
    tags: ['Astro', 'Markdown'],
  });
  assert.equal(parsed.body, '# 正文\n\n内容');
});

test('createPostRelativePath stores new posts by year and month', () => {
  assert.equal(
    createPostRelativePath({ pubDate: '2026-06-21', slug: 'Hello World' }),
    '2026/06/hello-world.md',
  );
});

test('safePostPath only allows markdown files inside blog content root', () => {
  const root = '/repo/src/content/blog';
  assert.equal(safePostPath(root, '2026/06/post.md'), path.join(root, '2026/06/post.md'));
  assert.throws(() => safePostPath(root, '../secret.md'), /非法文章路径/);
  assert.throws(() => safePostPath(root, '2026/06/post.txt'), /只支持 Markdown/);
});

test('sortPostsNewestFirst orders by pubDate descending', () => {
  const posts = [
    { meta: { pubDate: '2024-01-01' }, relativePath: 'old.md' },
    { meta: { pubDate: '2026-06-21' }, relativePath: 'new.md' },
    { meta: { pubDate: '2025-03-10' }, relativePath: 'middle.md' },
  ];

  assert.deepEqual(sortPostsNewestFirst(posts).map((post) => post.relativePath), [
    'new.md',
    'middle.md',
    'old.md',
  ]);
});

test('deletePost removes only markdown files inside blog content root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-editor-'));
  await fs.mkdir(path.join(root, '2026/06'), { recursive: true });
  const postPath = path.join(root, '2026/06/post.md');
  await fs.writeFile(postPath, '# test', 'utf8');

  const result = await deletePost(root, '2026/06/post.md');

  assert.deepEqual(result, { relativePath: '2026/06/post.md' });
  await assert.rejects(() => fs.access(postPath));
  await assert.rejects(() => deletePost(root, '../secret.md'), /非法文章路径/);
  await assert.rejects(() => deletePost(root, '2026/06/post.txt'), /只支持 Markdown/);
});

test('listImageFiles returns existing public images with markdown urls', async () => {
  const publicRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-editor-public-'));
  await fs.mkdir(path.join(publicRoot, 'images/2026/06'), { recursive: true });
  await fs.mkdir(path.join(publicRoot, 'images/misc'), { recursive: true });
  const oldImage = path.join(publicRoot, 'images/2026/06/cover.png');
  const newImage = path.join(publicRoot, 'images/misc/photo.JPG');
  await fs.writeFile(oldImage, 'x');
  await fs.writeFile(newImage, 'x');
  await fs.writeFile(path.join(publicRoot, 'images/misc/readme.txt'), 'x');
  await fs.utimes(oldImage, new Date('2026-06-01T00:00:00'), new Date('2026-06-01T00:00:00'));
  await fs.utimes(newImage, new Date('2026-06-02T00:00:00'), new Date('2026-06-02T00:00:00'));

  const images = await listImageFiles(publicRoot);

  assert.deepEqual(images.map((image) => image.url), [
    '/images/misc/photo.JPG',
    '/images/2026/06/cover.png',
  ]);
  assert.equal(images[0].mtimeMs > images[1].mtimeMs, true);
  assert.equal(images.find((image) => image.name === 'cover.png').month, '2026-06');
});
