// 给 markdown 中的绝对路径链接和图片添加 base 前缀
export function remarkBasePath(base) {
  const prefix = base.replace(/\/$/, ''); // 去掉末尾的 '/'
  return (tree) => {
    function visit(node) {
      const isAbsoluteUrl =
        typeof node.url === 'string' &&
        node.url.startsWith('/') &&
        !node.url.startsWith('//');
      if ((node.type === 'link' || node.type === 'image') && isAbsoluteUrl) {
        node.url = `${prefix}${node.url}`;
      }
      if (node.children) node.children.forEach(visit);
    }
    visit(tree);
  };
}
