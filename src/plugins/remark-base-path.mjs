// 给 markdown 中的绝对路径链接添加 base 前缀
export function remarkBasePath(base) {
  const prefix = base.replace(/\/$/, ''); // 去掉末尾的 '/'
  return (tree) => {
    function visit(node) {
      if (
        node.type === 'link' &&
        typeof node.url === 'string' &&
        node.url.startsWith('/') &&
        !node.url.startsWith('//') // 排除协议相对 URL
      ) {
        node.url = `${prefix}${node.url}`;
      }
      if (node.children) node.children.forEach(visit);
    }
    visit(tree);
  };
}
