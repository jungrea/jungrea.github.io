---
name: deployment-edit-workflow-clarification
description: 用户疑问：部署平台是否需要本地编辑 .md 文件
type: feedback
---

### 工作流说明

用户询问 Vercel、Cloudflare Pages 等平台是否都需要**本地编辑 Markdown 文件**。需要澄清：

1. **本地编辑 + Git Push** — 最常用，在本地用编辑器（VS Code 等）写 .md 文件，然后 `git push` 触发自动部署。
2. **GitHub Web 编辑器** — 可以直接在 GitHub 仓库里新建/编辑 .md 文件（无需本地环境），保存即 commit，触发部署。
3. **CMS / 后台编辑器** — 可以集成 Decap CMS、Netlify CMS 等，通过网页管理面板编写文章，自动生成 .md 文件并提交到仓库。
4. **Cloudflare Pages 的 Web 编辑器** — 部分平台（如 Cloudflare 控制台）也提供在线编辑功能。

**结论**：不是必须本地编辑，可以选择最适合的远程编辑方式。
