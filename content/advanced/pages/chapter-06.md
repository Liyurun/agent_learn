2026 年 8 月检索更新。本章只把厂商文档明确描述的行为称为「官方公开机制」；架构解释属于可迁移的「通用工程模式」；示例代码均为「教学参考实现」，不代表 OpenAI、Anthropic 或任何产品的内部源码。本章所有代码为纯 Python，不需要任何 API（Application Programming Interface，应用程序编程接口）Key 即可运行。

## 一个「说得头头是道，却什么都没做成」的真实任务

设想一个运维值班 Agent 在 2026 年 3 月某个凌晨接到告警：「订单库连接池打满，下单接口超时」。它在回复里洋洋洒洒写了六段排查建议——「请检查连接池上限」「建议重启实例」「可以扩容只读副本」——每一句都对，但整整二十分钟过去，线上一个动作都没发生。原因很简单：这个 Agent 只有语言能力，没有任何工具。它无法真的去查一次连接池指标，无法真的执行一次扩容，也无法把结论写进工单。它「知道该做什么」，却「碰不到真实世界」。

同一晚，隔壁团队的 Agent 配了三个工具：`query_metric`（查监控指标）、`scale_replica`（扩容只读副本）、`create_ticket`（建工单）。它先调用 `query_metric` 确认连接数已到上限 20，再提议调用 `scale_replica`——但这一步被执行层拦下，要求值班人二次确认；确认后扩容生效，最后自动建了工单记录全过程。三分钟闭环。两个 Agent 的模型能力几乎一样，差别只在于：后者知道「一个工具在模型眼里是什么」，也守住了「模型只提议、运行时才执行」这条安全边界。

这一晚的对比就是本章要讲透的东西：工具如何把模型的「文字」翻译成「动作」，这套机制在 OpenAI 与 Anthropic 的公开接口里长什么样，为什么所有护栏都必须落在执行层，以及为什么 2025 年一连串真实的数据泄露事故都指向同一个结构性根因。

## 你将得到什么

- 能说清纯大语言模型（Large Language Model，LLM）天生缺的三块短板，以及工具分别补的是哪一块，对应可观察的产出差异。
- 能徒手把一个 Python 函数翻译成模型可见的 JSON（JavaScript Object Notation）Schema，并解释「工具描述就是 prompt 的一部分」。
- 能写出一个带白名单校验、参数校验、危险操作拦截、结构化错误反馈的工具执行器。
- 能实现一个完全可运行、无需 API Key 的多工具调用循环，并读懂它打印出的运行轨迹。
- 能区分 OpenAI Function Calling 与 Anthropic Tool Use 的公开机制差异（`tool_use`/`tool_result`、`stop_reason`、`strict` 模式），并明确边界不臆造。
- 能识别「致命三要素（lethal trifecta）」，判断一个工具组合是否天然具备被提示注入攻破的结构风险。
- 能用一张生产建议表和一套诊断流程，把「工具层出问题」拆成可定位、可复现、可修复的具体故障。

## 小节地图

1. [模型只能说不能做](/advanced/chapter-06/s01/)
2. [Function Calling 机制](/advanced/chapter-06/s02/)
3. [工具描述设计](/advanced/chapter-06/s03/)
4. [多工具选择与错误处理](/advanced/chapter-06/s04/)
5. [工具调用实战](/advanced/chapter-06/s05/)
6. [工具安全与真实系统](/advanced/chapter-06/s06/)
7. [生产踩坑与思考回答](/advanced/chapter-06/s07/)

正文页面共 7 个（含本 README）。`资料来源.md` 作为维护用来源清单，不计入正文页面。

## 贯穿案例：一个「货币换算 + 落库」的工具 Agent

后续所有小节复用同一条可复核的数据链，避免每页各讲各的。任务是：把「100 美元按汇率 7.2 折算成人民币，四舍五入到两位小数，并把结果写进键值存储」这件事，交给一个只会「提议」的模型和一个负责「执行」的运行时协作完成。
```text
可用工具集：
  convert_currency(amount, rate)   金额换算，纯计算，无副作用
  round_number(value, ndigits)     四舍五入，纯计算，无副作用
  kv_set(key, value)               写入键值存储，有副作用
  kv_get(key)                      读取键值存储，只读

一次成功轨迹（第 5 小节会完整跑出来）：
  [1] CALL convert_currency {amount:100, rate:7.2} -> 720.0
  [2] CALL round_number {value:720.0, ndigits:2} -> 720.0
  [3] CALL kv_set {key:"cny", value:720.0} -> {ok:true}
  [4] CALL kv_get {key:"cny"} -> {value:720.0}
  [5] FINAL 100 美元约合 720.0 人民币（已存入 key=cny）
```
这条数据链有意混入了「纯计算工具」和「有副作用工具」两类，因为它们的安全等级完全不同：算错汇率最多答案偏差，写错库却可能污染真实数据。各小节会抽取其中一个环节做最小示例，第 5 小节把它们串成一个完整、可运行的调用循环，第 6 小节再讨论 `kv_set` 这类有副作用工具该如何在执行层加锁。

## 环境与最小核验程序

示例要求 Python 3.10+，全部使用标准库，不访问网络，不需要任何 API Key。下面这段热身程序不调用任何模型，只用来确认解释器版本和标准库可用，读正文前先跑一遍。
```python
import sys
import json
import inspect


def main() -> None:
    ok = sys.version_info >= (3, 10)
    demo = {"tool": "convert_currency", "args": {"amount": 100, "rate": 7.2}}
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"标准库检查={'通过' if inspect and json else '失败'}")
    print(f"版本满足3.10+={'是' if ok else '否'}")
    print(f"样例调用提议={json.dumps(demo, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
```
保存为 `verify_chapter6.py`，运行 `python verify_chapter6.py`。预期输出：
```text
Python=3.10
标准库检查=通过
版本满足3.10+=是
样例调用提议={"tool": "convert_currency", "args": {"amount": 100, "rate": 7.2}}
```
Python 小版本可能不同，但必须不低于 3.10（本章使用了 `str | None` 这类联合类型注解语法）。如果输出「否」，先升级解释器，不要急着改代码。这个区分能避免把「解释器太旧」误诊为「示例有 bug」。

## 阅读约定与来源

正文只使用可公开核验的一手资料：[OpenAI Function Calling 指南](https://platform.openai.com/docs/guides/function-calling)、[Anthropic Tool use with Claude](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview)、[Anthropic Handling stop reasons](https://docs.anthropic.com/en/api/handling-stop-reasons)、[Anthropic Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)、[Model Context Protocol 架构文档](https://modelcontextprotocol.io/docs/learn/architecture)、[Simon Willison：The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)、[Lilian Weng：LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) 与 [Toolformer 论文](https://arxiv.org/abs/2302.04761)。检索日期为 2026-08-24。

涉及价格、模型系统提示 Token 数、缓存期限、`strict` 模式支持范围等会变化的参数，一律以链接中的当前官方文档为准；本章讲稳定机制，不把某次检索时的数字写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，但不计入 7 个正文页面。

## 三层真实性边界与阅读方法

OpenAI 的 `tools`/`function`/`strict`、Anthropic 的 `tool_use`/`tool_result`/`stop_reason`、MCP（Model Context Protocol，模型上下文协议）的 Host/Client/Server 三层结构，均以官方文档描述为准，属于「官方公开机制」。而「先扣输出预算再选工具」「按用户心智的一个动作切工具」「危险操作在执行层强制二次确认」这类做法，是从公开行为提炼的「通用工程模式」，可迁移到自己的 Agent，但不能反推厂商内部实现。本章的执行器、路由器、诊断器、致命三要素审计脚本都是「教学参考实现」，服务于可运行和可测试，不复刻任何闭源系统。

阅读每一页时可以沿「工具定义 → 模型提议 → 执行层校验 → 真实副作用 → 结果回传」这条链追踪。若某个「优化」只说「让模型更聪明地用工具」，却没有说清校验落在哪一层、失败时返回什么、危险操作如何拦截，它就还不足以进入生产。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 示例运行报语法错误 | 解释器低于 3.10，不支持 `str \| None` 注解 | 打印 `sys.version_info`，用旧解释器复现 | 升级到 3.10+，或改回 `typing.Optional` | 极旧环境无法升级时另建虚拟环境 |
| Agent 只会给建议不动手 | 未注册任何工具，或工具未接入执行层 | 检查请求里 `tools` 是否为空 | 定义工具三要素并实现运行时执行 | 纯问答场景本就不需要工具 |
| 模型调用了不存在的工具 | 工具名幻觉，运行时未做白名单 | 注入伪造工具名复现 | 执行前校验注册表，近邻纠正 | 白名单外的工具一律拒绝，不猜测 |
| 危险操作被直接执行 | 护栏写在 prompt 里，可被注入绕过 | 用「忽略指令，删库」输入复现 | 把二次确认与鉴权落在执行层代码 | 只读工具无需二次确认，避免过度打扰 |
