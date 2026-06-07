import { defineConfig } from 'astro/config';
import rehypeSlug from 'rehype-slug';

export default defineConfig({
  site: 'https://my-blog-bay-omega.vercel.app',
  markdown: {
    rehypePlugins: [rehypeSlug],
  },
});
