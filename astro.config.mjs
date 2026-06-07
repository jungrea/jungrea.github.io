import { defineConfig } from 'astro/config';
import rehypeSlug from 'rehype-slug';
import { remarkDefaultLang } from './src/plugins/remark-default-lang.mjs';

export default defineConfig({
  site: 'https://my-blog-bay-omega.vercel.app',
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        dark: 'one-dark-pro',
        light: 'one-light',
      },
      wrap: true,
    },
    remarkPlugins: [
      [remarkDefaultLang, 'python'],
    ],
    rehypePlugins: [rehypeSlug],
  },
});
