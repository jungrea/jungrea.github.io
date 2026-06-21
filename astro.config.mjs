import { defineConfig } from 'astro/config';
import rehypeSlug from 'rehype-slug';
import { remarkDefaultLang } from './src/plugins/remark-default-lang.mjs';
import { remarkBasePath } from './src/plugins/remark-base-path.mjs';

export default defineConfig({
  site: 'https://jungrea.github.io',
  base: '/blog',
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
      [remarkBasePath, '/blog'],
    ],
    rehypePlugins: [rehypeSlug],
  },
});
