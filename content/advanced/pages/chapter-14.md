2026 年 8 月检索更新。本章遵循三层真实性标注：把 PydanticAI 官方文档明确描述的行为称为「官方公开机制」（有 [ai.pydantic.dev](https://ai.pydantic.dev/) 文档支撑）；把可从公开行为推导、能迁移到自建系统的做法称为「通用工程模式」；把书内为讲清原理而构造、可离线运行的纯 Python 代码称为「教学参考实现」。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造 PydanticAI 内部实现。会变化的细节（模型标识如 `openai:gpt-5.2`、价格、上下文窗口、Logfire 免费额度、SDK（Software Development Kit，软件开发工具包）方法名）一律以当前官方文档为准。

## 一次「金额写成约一万元」的真实故障

设想一个财务团队上线了发票抽取 Agent，目标是把邮件里的自由文本发票转成结构化记录写进数据库。上线第一周风平浪静，第八天凌晨对账批处理崩了：一条记录的 `amount` 字段是字符串 `"约一万元"`，下游 `sum()` 累加时抛出 `TypeError`，整批 3200 条对账全部回滚，财务同事早上九点上班发现昨日报表空白。复盘发现三处独立缺陷：第一，Agent 返回的是模型自由拼的 JSON（JavaScript Object Notation，一种数据交换格式），`amount` 有时是数字有时是中文金额，下游没有类型保障；第二，出现非法值时没有任何自动纠错，坏数据直接落库；第三，线上没有可观测性，等到批处理崩了才知道，中间八天里到底混进了多少条坏数据无人知晓。这三处都不是「模型不聪明」，而是把「LLM（Large Language Model，大语言模型）的输出」当成了「可以直接信任的数据」——而它本质上是一段需要被严格校验的不可信数据。

这个故障贯穿本章。PydanticAI 由 Pydantic 团队打造，它的核心信念恰好就是：**LLM 的输出是一段需要被校验的不可信数据，而校验不可信数据正是 Pydantic 的看家本领** [来源](https://ai.pydantic.dev/)。本章要把这条信念拆成可落地的六个环节：结构化输出怎么被强制、校验、重试；工具怎么注册且 Schema 自动生成；依赖怎么注入才能测试；`ModelRetry` 怎么把纠错前移；Logfire 与 `TestModel` 怎么让运行可观测、可离线测试；最后用一个完整的发票抽取流水线把上面「金额写成约一万元」的三处缺陷逐一堵死。

## 你将得到什么

- 能一句话说清 PydanticAI 的差异化定位（Pydantic 团队出品、把数据校验作为一等公民），并解释它为什么天然擅长「让 LLM 稳定返回结构化输出」。
- 能默画 `output_type` 背后的三层机制（机制层强制、校验层校验、兜底层重试），并说明它为什么不是「100% 保证」。
- 能用 `@agent.tool` / `@agent.tool_plain` 注册工具，并解释类型标注与 docstring 如何被 griffe 自动转成参数 JSON Schema。
- 能用 `deps_type` + `RunContext` 做依赖注入，写出一个「测试注入假库、生产注入真库、工具代码一行不改」的可测试用例。
- 能区分 `ModelRetry`（过程校验前移）与 `output_type` 重试（结果兜底），并说清「校验失败自动重试」本质是第 7 章反思的工程化。
- 能用 `logfire.instrument_pydantic_ai()` 打开 tracing，用 `TestModel` / `FunctionModel` + `Agent.override` 写出无需 API Key（Application Programming Interface Key，接口密钥）的离线单元测试。
- 能判断「这其实是 workflow 还是循环 Agent」，开出一张覆盖结构化输出、工具、依赖、可观测的生产建议清单，并回答多道高频面试题。

## 小节地图

1. [从「能跑」到「能上线」：结构化输出的鸿沟](/advanced/chapter-14/s01/)
2. [output_type 的三层机制：强制、校验、重试](/advanced/chapter-14/s02/)
3. [工具注册与自动 Schema：让模型「能做事」](/advanced/chapter-14/s03/)
4. [依赖注入与可测试性：解耦工具与它的依赖](/advanced/chapter-14/s04/)
5. [ModelRetry 与输出校验器：把纠错前移](/advanced/chapter-14/s05/)
6. [可观测性与离线测试：Logfire、TestModel 与 FunctionModel](/advanced/chapter-14/s06/)
7. [端到端实战：结构化发票抽取流水线](/advanced/chapter-14/s07/)
8. [选型边界、生产踩坑与思考回答](/advanced/chapter-14/s08/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕开头「金额写成约一万元」的发票故障展开。贯穿数据固定如下：
```text
贯穿输出模型（Pydantic 模型）：
class Invoice:
    vendor: str          ## 供应商名称
    amount: float        ## 金额，必须是数字（故障根因：模型曾给 "约一万元"）
    currency: str        ## 币种
    items: list[str]     ## 明细项

贯穿依赖（依赖注入）：
Deps.vendor_whitelist    ## 供应商白名单，测试注入假的、生产注入真的
Deps.exchange_rate       ## 汇率表，运行时才知道

一条问题触发的处理链：
自由文本发票 -> output_type=Invoice 强制结构化
             -> Pydantic 校验 amount 是否为 float
             -> 非法（"约一万元"）则把错误反馈给模型自动重试
             -> 工具 check_vendor 用注入的白名单校验 vendor（非法则 ModelRetry）
             -> 得到类型安全的 Invoice 对象，安全落库

目标输出：
一个通过校验的 Invoice 对象 + 每一步可在 Logfire/离线 trace 里复盘的事件
```
优化前，Agent 直接返回模型自由拼的 JSON、坏数据直接落库、无可观测；优化后，`output_type` 强制结构 + Pydantic 校验 + 失败重试 + `ModelRetry` 过程校验 + Logfire 追踪。输出「看起来像 JSON」不是判据——关键是每个字段都被类型系统规定过、非法值能被自动挡下、每一步都能被复盘。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码。它用纯 Python 把本章最核心的「三层机制」骨架固化成可运行的断言：声明结构（机制层）、用规则校验（校验层）、失败把错误喂回去重试（兜底层）。它不依赖 `pydantic_ai`，只用来确认解释器可用并建立心智模型。
```python
import sys


def validate_amount(raw):
    """校验层：金额必须能转成 float，否则返回一条给模型看的错误说明。"""
    try:
        return True, float(raw), ""
    except (TypeError, ValueError):
        return False, None, f"amount={raw!r} 不是合法数字，请只返回阿拉伯数字，如 10000"


def run() -> None:
    ## 机制层：假设模型第 1 轮返回坏值，第 2 轮被纠正后返回好值
    model_outputs = ["约一万元", "10000"]
    max_retries = 2
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    for attempt, raw in enumerate(model_outputs[:max_retries], start=1):
        ok, value, err = validate_amount(raw)
        if ok:
            print(f"[第{attempt}次] 校验通过 amount={value}（类型={type(value).__name__}）")
            print("热身通过：三层机制骨架跑通，可以开始阅读本章")
            return
        print(f"[第{attempt}次] 校验失败 -> 把错误喂回模型：{err}")
    print("重试耗尽仍失败：这就是为什么生产必须写兜底分支")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch14.py`，运行 `python warmup_ch14.py`。预期输出：
```text
Python=3.10
[第1次] 校验失败 -> 把错误喂回模型：amount='约一万元' 不是合法数字，请只返回阿拉伯数字，如 10000
[第2次] 校验通过 amount=10000.0（类型=float）
热身通过：三层机制骨架跑通，可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10。这段 12 行的骨架就是整章的缩影：**结构声明 + 规则校验 + 失败反馈重试**。PydanticAI 把这三层封装成了 `output_type` 一个参数，第 2 节会把它彻底拆开。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://ai.pydantic.dev/)（PydanticAI 官方文档首页，定位与总览）、[来源](https://ai.pydantic.dev/agents/)（Agents 概念，含 Agent 组成、运行方式、反思与自我纠错）、[来源](https://ai.pydantic.dev/output/)（Output，含 `output_type`、输出工具/原生/提示三种模式、输出函数、输出校验器）、[来源](https://ai.pydantic.dev/tools/)（Function Tools，含装饰器、参数 Schema 抽取、docstring 解析）、[来源](https://ai.pydantic.dev/dependencies/)（Dependencies，含 `deps_type`、`RunContext`、`override`）、[来源](https://ai.pydantic.dev/testing/)（Testing，含 `TestModel`、`FunctionModel`、`ALLOW_MODEL_REQUESTS`）、[来源](https://ai.pydantic.dev/logfire/)（Logfire/OpenTelemetry 集成）与 [来源](https://github.com/pydantic/pydantic-ai)（官方仓库，MIT 许可）。检索日期为 2026-08-24。

涉及价格、模型标识、上下文窗口、Logfire 免费额度、SDK 方法名等会变化的细节，以链接中的当前官方文档为准；本章讲稳定的机制与工程模式，不把某次检索到的字段拼写或数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。回扣关系：结构化输出的底层机制见第 8 章（Function Calling 端到端），反思机制见第 7 章，「先分清 workflow 还是 Agent」见第 3、12 章，可观测性深入见第 17 章，评估见第 16 章。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 下游 `sum()` 抛 TypeError | Agent 返回模型自由拼的 JSON，amount 时而是中文金额 | 抓一批线上输出统计 amount 的实际类型分布 | 用 `output_type=Invoice` 让 amount 强制为 float | 纯文本回答场景本就无结构约束 |
| 坏数据静默落库八天 | 非法值无自动纠错、无兜底分支 | 回放坏样本看是否直接写库 | Pydantic 校验 + 失败重试 + 最终兜底分支 | 允许人工复核的低频场景可放宽 |
| 崩了才知道混进坏数据 | 线上无可观测性 | 关闭 instrument 后复现「黑盒」 | `logfire.instrument_pydantic_ai()` 开 tracing | 极低价值任务可不接入观测 |
| 单测要连真实模型/数据库 | 依赖硬编码、无注入 | 跑单测发现要真实 API Key | `deps_type` 注入假依赖 + `TestModel` 覆盖 | 集成测试本就允许连真实系统 |
