import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMarkdown,
  createPostRelativePath,
  deletePost,
  listImageFiles,
  listPosts,
  readPost,
  safePostPath,
  slugify,
} from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const contentRoot = path.join(projectRoot, 'src/content/blog');
const publicRoot = path.join(projectRoot, 'public');
const editorRoot = path.join(__dirname, 'public');
const md2wxPath = path.join(__dirname, 'md2wx.html');
const port = Number(process.env.LOCAL_EDITOR_PORT || 4310);
const previewPort = Number(process.env.LOCAL_PREVIEW_PORT || 4321);

let previewProcess = null;
let previewLogs = [];

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function text(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  }[ext] || 'application/octet-stream';
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      shell: false,
      ...options,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    child.on('error', (error) => {
      resolve({ ok: false, code: 1, stdout, stderr: String(error?.message || error) });
    });
  });
}

async function ensureUniquePath(relativePath, allowedExistingPath = '') {
  const parsed = path.posix.parse(relativePath);
  let candidate = relativePath;
  let count = 2;

  while (true) {
    if (allowedExistingPath && candidate === allowedExistingPath) return candidate;
    try {
      await fs.access(safePostPath(contentRoot, candidate));
      candidate = path.posix.join(parsed.dir, `${parsed.name}-${count}${parsed.ext}`);
      count += 1;
    } catch {
      return candidate;
    }
  }
}

async function savePost(payload) {
  const meta = payload.meta || {};
  const body = payload.body || '';
  const isExisting = payload.relativePath && !payload.saveAsNew;
  const relativePath = isExisting
    ? payload.relativePath
    : await ensureUniquePath(createPostRelativePath({
        pubDate: meta.pubDate,
        slug: payload.slug || meta.slug || meta.title,
        title: meta.title,
      }));
  const absolutePath = safePostPath(contentRoot, relativePath);
  const markdown = buildMarkdown(meta, body);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, markdown, 'utf8');

  return {
    relativePath: path.relative(contentRoot, absolutePath).split(path.sep).join('/'),
    markdown,
  };
}

async function renamePostFile(payload) {
  const meta = payload.meta || {};
  const body = payload.body || '';
  const oldRelativePath = payload.relativePath;
  if (!oldRelativePath) throw new Error('请先保存文章，再重命名文件');

  const oldAbsolutePath = safePostPath(contentRoot, oldRelativePath);
  const targetRelativePath = await ensureUniquePath(createPostRelativePath({
    pubDate: meta.pubDate,
    slug: payload.slug || meta.title,
    title: meta.title,
  }), oldRelativePath);
  const targetAbsolutePath = safePostPath(contentRoot, targetRelativePath);
  const markdown = buildMarkdown(meta, body);

  await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
  await fs.writeFile(targetAbsolutePath, markdown, 'utf8');
  if (targetAbsolutePath !== oldAbsolutePath) await fs.unlink(oldAbsolutePath);

  return {
    relativePath: path.relative(contentRoot, targetAbsolutePath).split(path.sep).join('/'),
    markdown,
  };
}

async function saveImage(payload) {
  const dataUrl = String(payload.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(png|jpe?g|gif|webp|svg\+xml));base64,(.+)$/i);
  if (!match) throw new Error('只支持 png、jpg、gif、webp、svg 图片');

  const ext = match[2].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const baseName = slugify(path.parse(payload.name || 'image').name);
  const fileName = `${baseName}-${Date.now()}.${ext}`;
  const relativePath = path.posix.join('images', year, month, fileName);
  const absolutePath = path.join(publicRoot, ...relativePath.split('/'));

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(match[3], 'base64'));

  return { name: fileName, relativePath, url: `/${relativePath}` };
}

function startPreview() {
  if (previewProcess && !previewProcess.killed) {
    return { url: `http://127.0.0.1:${previewPort}`, alreadyRunning: true };
  }

  previewLogs = [];
  previewProcess = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(previewPort)], {
    cwd: projectRoot,
    env: process.env,
    shell: false,
  });

  const appendLog = (chunk) => {
    previewLogs.push(chunk.toString());
    if (previewLogs.length > 200) previewLogs = previewLogs.slice(-200);
  };

  previewProcess.stdout?.on('data', appendLog);
  previewProcess.stderr?.on('data', appendLog);
  previewProcess.on('close', (code) => {
    appendLog(`\n[preview exited: ${code}]\n`);
    previewProcess = null;
  });

  return { url: `http://127.0.0.1:${previewPort}`, alreadyRunning: false };
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/posts') {
    return json(res, 200, { posts: await listPosts(contentRoot) });
  }

  if (req.method === 'GET' && url.pathname === '/api/post') {
    const relativePath = url.searchParams.get('path');
    if (!relativePath) return json(res, 400, { error: '缺少文章路径' });
    return json(res, 200, { post: await readPost(contentRoot, relativePath) });
  }

  if (req.method === 'POST' && url.pathname === '/api/post') {
    return json(res, 200, { post: await savePost(await readJson(req)) });
  }

  if (req.method === 'POST' && url.pathname === '/api/post/rename') {
    return json(res, 200, { post: await renamePostFile(await readJson(req)) });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/post') {
    const relativePath = url.searchParams.get('path');
    if (!relativePath) return json(res, 400, { error: '缺少文章路径' });
    return json(res, 200, { post: await deletePost(contentRoot, relativePath) });
  }

  if (req.method === 'GET' && url.pathname === '/api/images') {
    return json(res, 200, { images: await listImageFiles(publicRoot) });
  }

  if (req.method === 'POST' && url.pathname === '/api/image') {
    return json(res, 200, await saveImage(await readJson(req)));
  }

  if (req.method === 'POST' && url.pathname === '/api/build') {
    return json(res, 200, await runCommand('npm', ['run', 'build']));
  }

  if (req.method === 'POST' && url.pathname === '/api/preview/start') {
    return json(res, 200, startPreview());
  }

  if (req.method === 'POST' && url.pathname === '/api/preview/stop') {
    if (previewProcess) previewProcess.kill('SIGTERM');
    previewProcess = null;
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/preview/logs') {
    return json(res, 200, { logs: previewLogs.join('') });
  }

  if (req.method === 'GET' && url.pathname === '/api/git/status') {
    return json(res, 200, await runCommand('git', ['status', '--short']));
  }

  if (req.method === 'POST' && url.pathname === '/api/git/commit-push') {
    const payload = await readJson(req);
    const message = String(payload.message || '').trim();
    if (!message) return json(res, 400, { error: '请填写提交信息' });

    const add = await runCommand('git', ['add', '-A']);
    if (!add.ok) return json(res, 200, add);

    const status = await runCommand('git', ['status', '--short']);
    if (!status.stdout.trim()) return json(res, 200, { ok: true, stdout: '没有需要提交的改动。\n', stderr: '' });

    const commit = await runCommand('git', ['commit', '-m', message]);
    if (!commit.ok) return json(res, 200, commit);

    if (payload.push === false) return json(res, 200, commit);

    const push = await runCommand('git', ['push']);
    return json(res, 200, {
      ok: push.ok,
      code: push.code,
      stdout: `${commit.stdout}\n${push.stdout}`,
      stderr: `${commit.stderr}\n${push.stderr}`,
    });
  }

  return json(res, 404, { error: '接口不存在' });
}

async function tryServeFromRoot(res, root, requestPath) {
  const absolutePath = path.resolve(root, `.${requestPath}`);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (absolutePath !== root && !absolutePath.startsWith(rootWithSep)) {
    text(res, 403, 'Forbidden');
    return true;
  }

  try {
    const file = await fs.readFile(absolutePath);
    res.writeHead(200, { 'Content-Type': getContentType(absolutePath) });
    res.end(file);
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      text(res, 500, String(error?.message || error));
      return true;
    }
    return false;
  }
}

async function serveMd2wx(res) {
  try {
    const html = await fs.readFile(md2wxPath, 'utf8');
    const bridge = `
<style>
  body.md2wx-embedded header { display: none !important; }
  body.md2wx-embedded main { height: 100vh !important; grid-template-columns: 1fr !important; }
  body.md2wx-embedded main > .pane:first-child { display: none !important; }
  body.md2wx-embedded .pane + .pane { border-left: none !important; }
  body.md2wx-embedded .pane-header { display: none !important; }
  body.md2wx-embedded .preview-wrap { height: 100vh !important; padding: 24px !important; }
</style>
<script>
  document.body.classList.add('md2wx-embedded');
  if (typeof buildInlineHTML === 'function') {
    render();
  }
  window.addEventListener('message', function(event) {
    var data = event.data || {};
    if (data.type === 'md2wx:setMarkdown') {
      editor.value = data.markdown || '';
      render();
    }
    if (data.type === 'md2wx:copy') {
      copyToClipboard();
    }
  });
  window.parent.postMessage({ type: 'md2wx:ready' }, '*');
</script>`;
    text(res, 200, html.replace('</body>', `${bridge}\n</body>`), 'text/html; charset=utf-8');
  } catch (error) {
    text(res, 500, `无法加载 md2wx.html：${String(error?.message || error)}`);
  }
}

async function serveStatic(res, url) {
  const requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);

  if (requestPath === '/md2wx.html') {
    await serveMd2wx(res);
    return;
  }

  if (await tryServeFromRoot(res, editorRoot, requestPath)) return;
  if (await tryServeFromRoot(res, publicRoot, requestPath)) return;

  text(res, 404, 'Not found');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      await serveStatic(res, url);
    }
  } catch (error) {
    json(res, 500, { error: String(error?.message || error) });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`本地写作助手已启动：http://127.0.0.1:${port}`);
  console.log('按 Ctrl+C 退出');
});
