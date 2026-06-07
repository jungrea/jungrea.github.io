// 给没有指定语言的代码块默认添加 python 标注
export function remarkDefaultLang(lang = 'python') {
  return (tree) => {
    function visit(node) {
      if (node.type === 'code' && !node.lang) {
        node.lang = lang;
      }
      if (node.children) node.children.forEach(visit);
    }
    visit(tree);
  };
}
