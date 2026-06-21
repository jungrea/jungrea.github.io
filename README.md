# My Blog

基于 [Astro](https://astro.build) 构建的个人技术博客，部署于 GitHub Pages。

## 技术栈

- **框架**：Astro 4
- **样式**：原生 CSS，支持深色/浅色主题切换
- **内容**：Markdown，通过 Astro Content Collections 管理
- **代码高亮**：Shiki（one-dark-pro / one-light）
- **部署**：GitHub Actions → GitHub Pages

## 项目结构

```
src/
├── components/   # UI 组件（Header、Footer、PostCard 等）
├── content/blog/ # Markdown 文章
├── layouts/      # 页面布局
├── pages/        # 路由页面
├── plugins/      # Remark 自定义插件
├── styles/       # 全局样式
└── utils/        # 工具函数
```

## 本地开发

```bash
npm install
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览构建结果
```

## 写作

在 `src/content/blog/` 下新建 `.md` 文件，头部使用 frontmatter 定义元数据：

```yaml
---
title: 文章标题
description: 文章简介
pubDate: 2026-01-01
tags: [标签1, 标签2]
---
```

推送到 `main` 分支后，GitHub Actions 自动构建并部署。
