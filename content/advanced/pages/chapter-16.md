2026 年 8 月检索更新。本章把厂商文档明确描述的能力称为「官方公开机制」；把可从公开行为推导、能迁移到自建系统的做法称为「通用工程模式」；把书内为讲清原理而构造、可离线运行的代码称为「教学参考实现」。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造任何厂商内部实现或未公开数字。

## 一次「上线三天才发现退步」的真实故障

一个电商客服 Agent（智能体）在 4 月 18 日上线了一版新 prompt，目标是把「安抚话术」写得更礼貌。灰度当天，团队随手测了六七个例子，觉得「读起来顺多了」，于是全量。三天后，客服主管发现退款相关工单的一次解决率（一句话解决、无需转人工）从 82% 悄悄掉到了 71%——新 prompt 让模型更爱「先共情两句」，却更常忘记先调用 `query_order` 核验订单，于是把「该走人工审批的大额退款」直接口头答应了。复盘时最扎心的一句话是：「我们上线前到底测了什么？」答案是——测了措辞，没测**任务是否真的完成**，更没测**工具是否用对**。

这个故障贯穿全章。它把一句模糊的「Agent 变差了」拆成评估体系里可定位的问题：改动前后有没有**离线基线**做对比（第 2 节）；有没有看**轨迹**而不只看措辞（第 3 节）；礼貌度这种主观项该由谁打分、打分器可信吗（第 4 节）；一次解决率、工具正确率这些**结果与过程指标**有没有被持续采集（第 5 节）；上线前有没有一道**回归门禁**把退步挡在合并之前（第 6 节）。把这条链路补齐，你就能回答生产化面试最高频的那道题——「你们怎么知道这次改动是改进而不是退步？」

## 你将得到什么

- 能说清 Agent 评估为什么不能照搬单元测试的「输入 X 必等于 Y」，并解释 `temperature=0` 也消不掉非确定性、必须靠通过率（pass rate）看分布。
- 能区分**离线评估**（对固定数据集跑批、开发期用）与**在线评估**（对线上流量抽样打分、生产期用），并让二者形成「线上失败回流到离线数据集」的闭环。
- 能用四种匹配模式（strict / unordered / superset / subset）和关键步骤查准查全（precision / recall）做**轨迹评估**，对齐 LangSmith AgentEvals 的公开语义。
- 能写出一个结构化、可解析、带理由的 **LLM 裁判（LLM-as-a-judge，大模型充当评审）**，识别位置偏差、长度偏差、自我偏好偏差，并用 Cohen's Kappa **校准**裁判与人工的一致性。
- 能采集并聚合**任务成功率、工具正确率、平均步数、P95 延迟、强停率**等指标，用「结果 × 轨迹」四象限识别「侥幸成功」。
- 能读懂 τ-bench、SWE-bench、GAIA、WebArena 等 2026 主流基准的定位与局限，并把评估接进**持续集成（Continuous Integration，CI）**做回归门禁，让退步无处可藏。
- 能开出一张覆盖评估各环节的生产建议清单，并回答多道与 Agent 评估相关的思考题。

## 小节地图

1. [为什么评估是 Agent 生产化的地基](/advanced/chapter-16/s01/)
2. [离线评估与在线评估](/advanced/chapter-16/s02/)
3. [轨迹评估：不止看结果，还要看怎么做](/advanced/chapter-16/s03/)
4. [LLM 裁判与校准](/advanced/chapter-16/s04/)
5. [任务成功率与工具正确率：结果与过程指标](/advanced/chapter-16/s05/)
6. [基准数据集与回归测试](/advanced/chapter-16/s06/)
7. [Agent 评估的生产踩坑与思考回答](/advanced/chapter-16/s07/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕开头「上线三天才发现退步」的客服 Agent 展开。工具集固定为三个只读查询 + 一个写操作；一条退款问题触发的黄金轨迹固定；评估样本从真实工单沉淀，每条带标准答案、分类、轨迹约束与红线。这样任意一节抽取其中一个环节做最小演示，第 6 节再把它们组合成回归门禁。
```text
工具集（4 个）：
query_order(order_id)          只读查询订单状态与金额
check_refund_policy(amount)    只读查询退款政策（是否需人工审批）
track_logistics(order_id)      只读查询物流
issue_refund(order_id, amount) 写操作：真正退款，金额>500 必须先人工审批

一条退款问题的黄金轨迹（结果 + 轨迹双约束）：
用户：订单 A-2026 我要退款
必经关键步：query_order -> check_refund_policy -> issue_refund（顺序敏感：先核验再退款）
红线（must_not_do）：金额>500 未经审批直接 issue_refund

评估样本（从真实工单沉淀，示例三条）：
refund-0418  退款金额是多少          gold=88.00      category=退款
logi-0419    物流到哪了             gold=已签收      category=查询
bigrefund-0420 大额退款怎么办        gold=需人工审批  category=退款  redline=True
```
优化前，团队只肉眼看措辞、只跑一两次、上线后靠用户投诉才发现退步；优化后，改动先过离线基线对比、多次采样看通过率、轨迹约束卡住「先核验再退款」、红线零容忍，退步在合并前就被 CI 拦下。输出「读起来是否更顺」不是判据——关键是任务成功率、工具正确率、红线违规数这些可度量的量到底动了没、往哪动。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，把本章三条评估不变量固化成断言：评估看**分布（通过率）**而非单次结果；结果对 ≠ 没问题，还要看**轨迹**（识别侥幸成功）；**红线零容忍**。
```python
import sys


def pass_rate(hits: list[bool]) -> float:
    """通过率而非单次结果——对抗非确定性的第一原则。"""
    return sum(hits) / len(hits)


def is_lucky_success(result_ok: bool, trajectory_ok: bool) -> bool:
    """侥幸成功：结果对但轨迹差，是生产里最隐蔽的坑。"""
    return result_ok and not trajectory_ok


def run() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    # 不变量1：评估看分布，5次采样3次对 => 0.6
    print(f"通过率(3/5)={pass_rate([True, False, True, True, False])}")
    # 不变量2：结果对≠没问题，要看轨迹
    print(f"是侥幸成功={is_lucky_success(result_ok=True, trajectory_ok=False)}")
    # 不变量3：红线零容忍
    redline_hit = 1
    print(f"红线可放行={redline_hit == 0}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch16.py`，运行 `python warmup_ch16.py`。预期输出：
```text
Python=3.10
通过率(3/5)=0.6
是侥幸成功=True
红线可放行=False
热身通过：可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10（本章用到 `list[dict]` 等内置泛型标注与 `statistics.quantiles`）。若「是侥幸成功」为 False，说明你把断言写反了——结果对而轨迹差恰恰是本章反复强调要抓的隐蔽坑。

## 阅读约定与来源

正文只引用可公开核验的一手资料：[来源](https://docs.langchain.com/langsmith/evaluation-concepts)（LangSmith 评估概念，含离线/在线、LLM-as-judge、轨迹评估）、[来源](https://docs.langchain.com/langsmith/trajectory-evals)（LangSmith 轨迹评估与 AgentEvals 的 strict/unordered/subset/superset 四模式）、[来源](https://developers.openai.com/api/docs/guides/evals)（OpenAI Evals 指南，含数据源与打分器 graders、Evals 平台弃用时间线）、[来源](https://www.anthropic.com/engineering/building-effective-agents)（Anthropic《Building Effective Agents》，评估与迭代贯穿其主张）、[来源](https://www.anthropic.com/engineering/multi-agent-research-system)（Anthropic 多智能体研究系统，含 LLM 裁判 rubric 五维度与「用小样本快速迭代」经验）。基准部分参考公开榜单综述（τ-bench、SWE-bench、GAIA、WebArena，见第 6 节与资料来源）。检索日期为 2026-08-24。

涉及榜单分数、模型标识、价格、平台弃用日期、SDK（Software Development Kit，软件开发工具包）方法名等会变化的细节，一律以链接中的当前官方文档与最新榜单为准；本章讲稳定的评估方法论与协议，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 上线三天才发现退步 | 只测措辞、无离线基线对比 | 回放上线前后同一批样本的任务成功率 | 改动前必过离线基线 + 回归门禁 | 纯文案微调且无工具的场景风险低 |
| 「读起来更顺」当成变好 | 把主观措辞当唯一判据 | 补测工具正确率与一次解决率 | 结果 + 轨迹双维度评估 | 无工具的闲聊 Agent 另算 |
| 大额退款被口头答应 | 轨迹漏了 query_order 与审批 | 检查轨迹是否含必经关键步 | must_call + must_not_do 轨迹约束 | 无副作用只读任务无红线 |
| 灰度「跑几个例子还行」 | 单次结果当结论、无通过率 | 同一样本采样 5 次看命中分布 | 多次采样看 pass@k 与通过率 | 确定性规则型子任务可跑一次 |
