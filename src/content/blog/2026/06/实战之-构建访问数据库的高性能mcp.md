---
title: "实战之：构建访问数据库的高性能mcp"
description: "构建访问数据库的高性能mcp"
pubDate: 2026-06-21
tags: ["mcp", "大模型"]
---

# 实战之：构建访问数据库的高性能mcp

本节介绍实际工作中如何构建高可靠性的访问数据库的mcp供大模型使用。通过构建数据库的mcp，可以使得大模型可以自由灵活的读取数据，可以让大模型自己快速写sql获得结果，这对于日常需要从数据库中读取分析数据来说带来的是速度与效果质的飞跃。

本节假设你已经了解了mcp的相关基础原理，如果不了解可以参考历史文章： mcp篇。

同时假设你也了解数据库、日常会使用到数据库，接触过写sql、操作数据库等内容，本文主要以mysql的mcp为例。

## 1. mysql的mcp最小服务框架

我们知道，日常我们从数据库中获得数据的方法就是写SQL，SQL的语法有非常多的类型，不同的SQL写法可以获得不同的数据，一旦我们写好了一个SQL语句以后我们就可以送到MySQL客户端去执行这条语句，从而获取数据。我们把从数据库中获取数据的过程核心简化为两个步骤：
* （1）编写SQL语句
* （2）客户端执行该SQL语句

这两个步骤的第一步，编写SQL语句，完全可以交给大模型来自己产生。而第二步就是我们今天要核心探讨的，通过MCP的方式来从服务器上执行获取。

为了演示，部署一个mcp的最核心代码框架如下：

```
# 最简 MCP 服务
import pymysql
from mcp.server.fastmcp import FastMCP

# 初始化 MCP 服务
mcp = FastMCP("mysql-mcp-server-sample")

class db:
    """极简 MySQL 连接封装"""
    def __init__(self, host, port, user, passwd, database):
        self.conn = pymysql.connect(
            host=host, port=port, user=user, passwd=passwd, db=database,
            charset="utf8", use_unicode=True,
        )
        self.cursor = self.conn.cursor()

    def execute_sql(self, sql):
        self.cursor.execute(sql)
        return self.cursor.fetchall()

    def close(self):
        self.cursor.close()
        self.conn.close()

@mcp.tool()
def query(sql: str) -> list:
    """
    在数据库上执行 SQL 查询。

    参数:
        sql: SQL 语句
    返回:
        查询结果列表
    """
    d = db("ip地址xxx", "端口xxx", "userxx", "passwdxx", "databasexx")
    try:
        return d.execute_sql(sql)
    finally:
        d.close()
 
# 启动服务
if __name__ == "__main__":
    mcp.run()
```

解释一下结构，mcp通常部署在服务器上，且服务器上可以通过pymysql库连接数据库。那么这个最简mcp中实现了传入sql就能获执行结果的工具函数：`query(sql: str)`。

最简mcp实现的是一个执行任何sql的工具函数，具体的sql语句是需要传入的，传入的语句可以是人写的也可以是大模型自动写的，我们的目标是大模型自动写sql，然后调用工具执行拿到结果，充分实现自主探索自动分析的能力。

## 2. 实际中的要命问题

以上mcp在正确填写了mysql访问相关的参数后，理论上是可以执行的，但是这个最简mcp在实际过程中存在很多问题，距离实际生产要达到的高性能还差很远。问题包括：

* **高危sql语句无拦截**

sql语句不光有查询数据的语句，还有很多其他类型的语句，比如说删除数据，改数据，删表，改名等等。
一旦让大模型自动生成了删除数据的sql，然后又调用了改工具让mysql客户端执行了sql，那么数据就被删了，这对于大模型自动化功能来说还是非常危险的，毕竟大模型并不具备这种安全意识。

* **sql超时卡死mcp**

我们说SQL语句具有很多的类型，并不是写的每一个SQL都能够完整的被客户端执行，并返回结果。当一个数据表特别大的时候，同时SQL语句又特别复杂的时候，就会存在固定时间内无法执行完成的情况。对于这种SQL超时的时候，那么从大模型端看到的就是这个MCP处于一直未返回结果的状态，陷入一种卡死状态，此时哪怕你再调用该MCP就会出现无法调用的情况。

* **高并发调用工具怎么办**

我们说一个MCP部署到服务端以后，通常情况下要提供给对外很多人用，那么当多人同时调用MCP工具的时候，如果没有一些并发线程机制，那么也是没有办法保证所有人都能够完整的调用到工具的。

* **给大模型看的返回结果**

这算是我们部署任何MCP都会面临的一个问题。一个MCP的工具函数，如果返回的结果类型非常不标准的时候，通常情况下会给大模型的使用造成一定的困难。我们知道大模型最擅长读什么样的数据呢？是非常格式化、标准化的数据，尤其是带Schema的数据，因此，任何一个MCP工具返回的结果最好是带Schema格式的数据。

## 3. 高性能mcp解决方案

对于上述提到的几个问题，只要在MCP中解决好之后，那么这个数据读取的MCP就是一个非常高性能的MCP了，下面给出实战方案。

### 3.1 高危sql拦截
为了避免大模型可能产生的高危SQL语句自动执行的问题，我们只有在代码层严格限制，才能够从根源上杜绝这个问题，限制的方法就是在代码上对于高危SQL语句进行拦截，我们只允许非高危的SQL语句，比如说SELECT语句进行放行执行。

例如以下可以作为高危SQL语句检测的一般方法：

```
# 高危 SQL 关键字（按语句开头匹配，避免误伤数据中的关键字）
DANGEROUS_KEYWORDS = [
    "DROP",        # 删库/删表/删索引
    "DELETE",      # 删数据
    "TRUNCATE",    # 清空表
    "UPDATE",      # 修改数据
    "INSERT",      # 插入数据
    "REPLACE",     # 替换数据
    "ALTER",       # 修改表结构
    "CREATE",      # 创建库/表
    "RENAME",      # 重命名
    "GRANT",       # 授权
    "REVOKE",      # 撤销授权
    "LOAD",        # LOAD DATA / LOAD FILE
    "CALL",        # 调用存储过程
    "HANDLER",     # HANDLER OPEN/READ/CLOSE
    "LOCK",        # LOCK TABLES
    "UNLOCK",      # UNLOCK TABLES
]


def _check_sql_safety(sql: str) -> tuple:
    """
    SQL 安全检查：拦截高危操作。

    返回:
        (is_safe: bool, reason: str)
    """
    if not sql or not sql.strip():
        return False, "SQL 不能为空"

    # 1. 去除注释（-- 单行注释 和 /* */ 多行注释），防止绕过
    cleaned = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    cleaned = re.sub(r"--[^\n]*", " ", cleaned)
    cleaned = re.sub(r"#[^\n]*", " ", cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        return False, "SQL 内容为空（去除注释后）"

    # 2. 拆分多语句（按 ; 切分），逐条校验，防止"select 1; drop table x"绕过
    statements = [s.strip() for s in cleaned.split(";") if s.strip()]
    if len(statements) > 1:
        return False, f"不允许一次执行多条 SQL 语句（检测到 {len(statements)} 条）"

    stmt = statements[0]

    # 3. 提取首单词作为操作类型
    first_word_match = re.match(r"^\s*(\w+)", stmt)
    if not first_word_match:
        return False, "无法解析 SQL 语句类型"
    first_word = first_word_match.group(1).upper()

    # 4. 仅允许 SELECT、SHOW、DESC/DESCRIBE、EXPLAIN 等只读操作
    allowed_first_words = {"SELECT", "SHOW", "DESC", "DESCRIBE", "EXPLAIN"}
    if first_word not in allowed_first_words:
        return False, f"禁止执行非查询类语句，检测到操作类型：{first_word}"

    # 5. 二次扫描语句正文，防止形如 "SELECT ... INTO OUTFILE"、子查询里嵌入危险语句
    upper_stmt = " " + stmt.upper() + " "
    for kw in DANGEROUS_KEYWORDS:
        # 用单词边界匹配，避免 column 名误伤
        if re.search(r"\b" + kw + r"\b", upper_stmt):
            return False, f"SQL 中包含高危关键字：{kw}"

    # 6. 拦截 SELECT ... INTO OUTFILE/DUMPFILE（导出文件）
    if re.search(r"\bINTO\s+(OUT|DUMP)FILE\b", upper_stmt):
        return False, "禁止使用 INTO OUTFILE / DUMPFILE 导出文件"

    return True, ""

```

我们只需要在SQL正式执行前，执行一遍这个函数`_check_sql_safety`即可以做到对高危SQL的拦截。

### 3.2 sql卡死方法：设置最长执行时间

对于大的SQL表或者是复杂的SQL语句，当SQL客户端执行非常耗时的时候，为了避免卡死，最好的方法就是设置一个最长执行时间。

由于我们的SQL语句最终是由大模型生成的，那么大模型有的时候会生成非常愚蠢的SQL，比如说有些数据应该加分区，但是它生成的时候没有加分区，这样的SQL去一个大表执行的时候铁定会超时。

超时保护的具体代码段如下：

```
async def _execute_db_sql_async(db_getter, sql: str, max_rows=MYSQL_MAX_RESULT_ROWS):
    """将同步 MySQL 查询放到线程池，并增加超时保护。"""
    try:
        rows = await asyncio.wait_for(
            asyncio.to_thread(_execute_db_sql_sync, db_getter, sql, max_rows),
            timeout=SQL_TOOL_TIMEOUT_SECONDS,
        )
        return rows
    except asyncio.TimeoutError:
        raise TimeoutError(f"SQL 执行超过 {SQL_TOOL_TIMEOUT_SECONDS} 秒，已主动超时")


async def _run_sql(db_getter, sql: str) -> dict:
    """辅助函数：执行 SQL 并统一封装返回结果。"""
    is_safe, reason = _check_sql_safety(sql)
    if not is_safe:
        return {
            "状态": "失败",
            "原因": f"高危 SQL 已被拦截：{reason}",
            "SQL": sql,
            "结果行数": 0,
            "查询结果": [],
        }
    try:
        res = await _execute_db_sql_async(db_getter, sql)
        return {
            "状态": "成功", "原因": "", "SQL": sql,
            "结果行数": len(res), "查询结果": res,
        }
    except TimeoutError as e:
        return {
            "状态": "失败", "原因": str(e), "SQL": sql,
            "结果行数": 0, "查询结果": [],
        }
    except Exception as e:
        return {
            "状态": "失败", "原因": str(e), "SQL": sql,
            "结果行数": 0, "查询结果": [],
        }
```
这里我们启动了一个超时保护的机制，比如说`SQL_TOOL_TIMEOUT_SECONDS=30`代表一个SQL最多允许执行30秒时间，超时了则不会等待这个SQL执行完成，直接返回**"SQL 执行超过xxx"**, 不要小看这一段文字描述结果，这是大模型具备自动纠正复杂SQL变成正常SQL的一个个重要途径，实际过程中我们就能看到一个这样的现象：

```
> 因为某个需求大模型生成了一个SQL_A（性能不够优化的sql）
> mcp 调用工具执行 SQL_A
> 工具超时，返回结果："SQL 执行超过xxx"
> 大模型拿到"超时"这样的结论后进行思考，能知道可能是自己写的SQL_A性能不够，
此时会尝试生成一个更优化版本的SQL_B
> mcp 调用工具执行 SQL_B
> ...
```
所以我们说**超时提醒**是大模型能够自我纠正反思的关键一环，如果我们只返回一个执行失败，那大模型是不知道反思的，它可能只是觉得没有数据导致的失败等等。

### 3.3 高并发调用方案：async + asyncio.to_thread 的组合拳

上面的代码我们已经给了这种组合的方案使用，现在来讲一讲这种方式的原理：

* asyncio.to_thread：把阻塞操作扔到线程池（不卡主循环）
* async/await：等线程池做完后拿回结果（不轮询、不阻塞）

对比我们最原始的同步写法，那么这种写法的优势如下：

| 特性 | 同步写法 | `async` + `asyncio.to_thread` |
| ---- | ---- | ---- |
| SQL 执行时能否处理其他请求 | ❌ 不能 | ✅ 能 |
| 多个工具调用并发 | ❌ 排队 | ✅ 并行 |
| 超时控制 | ❌ 需要自己写线程 | ✅ 原生支持 |
| 代码复杂度 | 简单 | 稍高 |
| 适合场景 | 单用户、低并发 | 多用户、高并发 |

### 3.4 给大模型看的返回结果

这一块比较重要，我们说工具返回给大模型看的结果不能太随便，比如说返回一个字符串啊，返回一个数字等等，这些很随意的结果反馈给大模型虽然也能看懂，但是非常的不友好，而且很容易给大模型造成一些处理上的幻觉。标准的做法是**返回的结果一定要是结构化数据**，最典型的，比如说是JSON格式的数据。

比如我们前面给的函数的return：

```
async def _run_sql(db_getter, sql: str) -> dict:
    """辅助函数：执行 SQL 并统一封装返回结果。"""
    is_safe, reason = _check_sql_safety(sql)
    if not is_safe:
        return {
            "状态": "失败",
            "原因": f"高危 SQL 已被拦截：{reason}",
            "SQL": sql,
            "结果行数": 0,
            "查询结果": [],
        }
     ...
```

## 4. 总结

本节主要以设计mysql的mcp调用为例，讲述如何设计一个高性能、高稳定的MCP工具，这种设计思想其实适合所有的MCP工具设计。

对于Agent来说，高性能稳定且有不同明确返回含义的结构化数据，配合agent本身的loop循环思考机制，可以说能最大限度的发挥大模型的能力并实现一些智能化的效果。
