---
title: 'Markdown 写作完全指南'
description: '从基础语法到进阶技巧，掌握 Markdown 高效写作的所有要点。包含代码块、表格、链接等常用语法速查。'
pubDate: 2025-12-03
tags: ['工具', '写作']
---

## 基础语法速查

### 标题

```markdown
# H1 一级标题
## H2 二级标题
### H3 三级标题
#### H4 四级标题
```

### 文本样式

```markdown
**粗体**
*斜体*
~~删除线~~
`行内代码`
```

### 链接与图片

```markdown
[链接文字](https://example.com)
![图片描述](image-url.png)
```

## 列表

### 无序列表

- 项目一
- 项目二
  - 子项 A
  - 子项 B
- 项目三

### 有序列表

1. 第一步
2. 第二步
3. 第三步

## 代码块

使用三个反引号包裹，并指定语言获得语法高亮：

```python
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
```

```javascript
const greeting = (name) => {
  return `Hello, ${name}!`;
};
```

## 表格

| 属性 | 类型 | 说明 |
|------|------|------|
| `title` | string | 文章标题 |
| `pubDate` | date | 发布日期 |
| `tags` | string[] | 标签列表 |

## 引用

> 代码是写给人看的，顺便能在机器上运行。
>
> — Harold Abelson

## 分割线

使用 `---` 创建分割线。

---

## 小技巧

- 在 VSCode 中使用 `Cmd+Shift+V` 预览 Markdown
- 空行分隔段落
- 行末两个空格可以实现软换行

以上就是常用的 Markdown 语法，掌握这些足够日常写作了！
