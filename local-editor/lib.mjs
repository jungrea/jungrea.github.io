import fs from 'node:fs/promises';
import path from 'node:path';

export function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^[\]\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'untitled';
}

function toDateString(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function escapeYamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function parseScalar(value) {
  const trimmed = String(value || '').trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed.replace(/^'/, '"').replace(/'$/, '"'));
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

export function parseMarkdown(markdown) {
  const text = String(markdown || '').replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    return {
      meta: {
        title: '',
        description: '',
        pubDate: new Date().toISOString().slice(0, 10),
        updatedDate: '',
        tags: [],
      },
      body: text,
    };
  }

  const meta = {
    title: '',
    description: '',
    pubDate: new Date().toISOString().slice(0, 10),
    updatedDate: '',
    tags: [],
  };

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = parseScalar(line.slice(index + 1));
    if (key === 'tags') {
      meta.tags = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
    } else if (key in meta) {
      meta[key] = String(value);
    }
  }

  return {
    meta,
    body: text.slice(match[0].length).replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
  };
}

export function buildMarkdown(meta, body) {
  const title = String(meta?.title || '').trim() || '未命名文章';
  const description = String(meta?.description || '').trim();
  const pubDate = toDateString(meta?.pubDate);
  const updatedDate = meta?.updatedDate ? toDateString(meta.updatedDate) : '';
  const tags = Array.isArray(meta?.tags) ? meta.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  const content = String(body || '').replace(/^\s+/, '').replace(/\s+$/, '');

  const lines = [
    '---',
    `title: ${escapeYamlString(title)}`,
    `description: ${escapeYamlString(description)}`,
    `pubDate: ${pubDate}`,
  ];

  if (updatedDate) lines.push(`updatedDate: ${updatedDate}`);
  lines.push(`tags: [${tags.map(escapeYamlString).join(', ')}]`);
  lines.push('---', '', content, '');

  return lines.join('\n');
}

export function createPostRelativePath({ pubDate, slug, title }) {
  const date = new Date(pubDate || Date.now());
  const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
  const year = String(safeDate.getFullYear());
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const fileName = `${slugify(slug || title)}.md`;

  return path.posix.join(year, month, fileName);
}

export function safePostPath(contentRoot, relativePath) {
  const root = path.resolve(contentRoot);
  const absolute = path.resolve(root, String(relativePath || ''));
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    throw new Error('非法文章路径：只能访问博客文章目录内的文件');
  }

  if (!/\.md(?:own)?$/i.test(absolute)) {
    throw new Error('只支持 Markdown 文件');
  }

  return absolute;
}

export function sortPostsNewestFirst(posts) {
  return [...posts].sort((a, b) => {
    const left = new Date(a?.meta?.pubDate || 0).valueOf();
    const right = new Date(b?.meta?.pubDate || 0).valueOf();
    return right - left;
  });
}

export async function listMarkdownFiles(rootDir) {
  const result = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (/\.md(?:own)?$/i.test(entry.name)) {
        result.push(path.relative(rootDir, absolute).split(path.sep).join('/'));
      }
    }
  }

  await walk(rootDir);
  return result.sort();
}

export async function readPost(contentRoot, relativePath) {
  const absolute = safePostPath(contentRoot, relativePath);
  const markdown = await fs.readFile(absolute, 'utf8');
  const parsed = parseMarkdown(markdown);

  return {
    relativePath: path.relative(contentRoot, absolute).split(path.sep).join('/'),
    meta: parsed.meta,
    body: parsed.body,
  };
}

export async function deletePost(contentRoot, relativePath) {
  const absolute = safePostPath(contentRoot, relativePath);
  await fs.unlink(absolute);

  return {
    relativePath: path.relative(contentRoot, absolute).split(path.sep).join('/'),
  };
}

export async function listPosts(contentRoot) {
  const files = await listMarkdownFiles(contentRoot);
  const posts = await Promise.all(files.map(async (file) => {
    const post = await readPost(contentRoot, file);
    return {
      relativePath: post.relativePath,
      meta: post.meta,
    };
  }));
  return sortPostsNewestFirst(posts);
}
