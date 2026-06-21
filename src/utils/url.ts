/** Prefix an absolute path with the configured base path. */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, ''); // e.g. '/blog'
  return `${base}${path}`;
}
