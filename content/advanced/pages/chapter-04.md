2026 年 8 月检索更新。本章只把论文与厂商文档明确描述的行为称为“官方公开机制”；把可迁移的架构解释称为“通用工程模式”；示例代码均为教学参考实现，不代表任何产品（OpenAI o 系列、Anthropic Claude、LangGraph 等）的内部源码。涉及价格、上下文窗口、思考预算等会变化的参数，一律以当前官方文档为准。

## 一个“不规划就翻车”的真实任务

某数据团队让一个编程 Agent 处理工单：“把过去 30 天的订单导出、按地区聚合、生成报表并发到群里。”第一版 Agent 没有任何规划环节，拿到任务就直接开始调用工具：它先调了发消息工具想“先占个群位”，接着才发现还没有数据；然后去查数据库，却因为没有先确认时间口径，把“下单时间”当成了“支付时间”，导出了错误的 30 天；聚合脚本又因为地区字段有空值直接抛异常。整个过程跑了 14 轮工具调用、耗时 9 分钟，最终产出一份错误报表，还提前在群里发了半句“报表马上好”，造成误导。

复盘时大家发现，问题根本不在某一次工具调用写错了参数，而在于**它从头到尾没有一份“先做什么、再做什么、每步的前提是什么”的计划**。当团队给它加上一个显式的“先规划、再执行、执行中发现前提不成立就重规划”的骨架后，同样的任务变成：先确认时间口径与地区字段清洗规则（1 次澄清）、再导出、再聚合、最后才发消息，5 步一次通过。这就是本章要解决的问题：**让 Agent 在动手之前先“想清楚路”，并在推理与行动之间建立可控的循环。**

## 你将得到什么

- 能从“自回归单次前向传播算力固定”的底层机制，讲清为什么“一步步想”能提升复杂推理准确率（对应 02 节可运行演示）。
- 能手写并运行一个不依赖任何框架的最小 ReAct（Reasoning and Acting，推理与行动）循环，并说清它的两种终止条件（对应 03、06 节代码）。
- 能区分 Plan-and-Execute（先规划后执行）与 ReWOO（Reasoning WithOut Observation，无观察推理），并用代码量化两者的 LLM 调用次数差异（对应 04、06 节）。
- 能实现 ToT（Tree of Thoughts，思维树）的 beam search（束搜索）骨架，理解它的算力成本从何而来（对应 05 节）。
- 能用一张决策流程为新任务选出 CoT / Self-Consistency / ReAct / ToT 中最合适的最低层次（对应 05、07 节）。
- 能拿到一张≥12 行的生产踩坑对照表，覆盖解析脆弱、上下文膨胀、原地打转、评估器失灵等真实故障（对应 07 节）。

## 小节地图

1. [为什么需要推理与规划](/advanced/chapter-04/s01/)
2. [CoT 思维链：把串行计算摊开在时间轴上](/advanced/chapter-04/s02/)
3. [ReAct：推理与行动交织](/advanced/chapter-04/s03/)
4. [Plan-and-Execute 与 ReWOO：先规划后执行 vs 边想边做](/advanced/chapter-04/s04/)
5. [ToT 与多路径搜索：自洽性与树搜索](/advanced/chapter-04/s05/)
6. [规划模式实战：ReAct 与 Plan-Execute 骨架对比](/advanced/chapter-04/s06/)
7. [推理与规划的生产踩坑与思考回答](/advanced/chapter-04/s07/)

## 贯穿案例：一道“折扣计算”和一次“市场调研”

本章所有小节复用同一条可复核的数据链，方便你在不同范式之间横向对比：
```text
贯穿任务 A（纯计算，用于 CoT / ReAct 演示）：
  某书原价 120 元,打 7 折后再用 20 元优惠券,最终多少钱?省了百分之几?
  真值：120*0.7-20 = 64.0 元；(120-64)/120*100 = 46.666...% ≈ 46.7%

贯穿任务 B（多工具、有依赖，用于 Plan-Execute / ReWOO 演示）：
  查原价(price)→查折扣(discount)→查优惠券(coupon)→代入求最终价
  真值：120 * 0.7 - 20 = 64.0 元

贯穿指标（用于 ToT / 生产诊断演示）：
  搜索深度 depth、束宽 beam_width、每步候选数 k、LLM 调用次数、重复动作占比
```
任务 A 简单到用 CoT 甚至心算就能做，但正因为简单，才适合暴露“一次性输出为什么会错”与“ReAct 循环如何靠上下文累积状态”。任务 B 有明确的步骤依赖，适合对比“边想边做”与“先规划后执行”的调用成本差异。后续每一节都会从这条数据链里抽取一个片段做最小示例，06 节则把它们拼成一个完整可运行的对比程序。

## 最小环境核验程序

在开始阅读前，先确认解释器版本与章节文件齐全。下面这段程序不调用任何模型，也不修改任何文件，只做存在性检查。
```python
from pathlib import Path
import sys

REQUIRED = [
    "README.md",
    "01-为什么需要推理与规划.md",
    "02-CoT思维链.md",
    "03-ReAct推理与行动交织.md",
    "04-Plan-and-Execute与ReWOO.md",
    "05-ToT与多路径搜索.md",
    "06-规划模式实战.md",
    "07-生产踩坑与思考回答.md",
]

def main() -> None:
    root = Path("第一部分-系统学习教材/卷二-核心能力原语/第4章-推理与规划")
    missing = [name for name in REQUIRED if not (root / name).is_file()]
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"章节目录={root.name}")
    print(f"文件检查={'通过' if not missing else '失败'}")
    print(f"缺失={missing}")

if __name__ == "__main__":
    main()
```
从仓库根目录保存为 `verify_chapter4.py`，运行 `python verify_chapter4.py`。预期输出为：
```text
Python=3.10
章节目录=第4章-推理与规划
文件检查=通过
缺失=[]
```
Python 小版本可能不同，但需不低于 3.10（本章代码用到了 `list[str]`、`dict` 等内置泛型标注）。若输出“失败”，先检查运行目录是否为仓库根目录，再检查文件是否齐全，不要急于改代码。

## 阅读约定与来源

正文只使用可公开核验的一手资料：[Chain-of-Thought Prompting 论文（arXiv:2201.11903）](https://arxiv.org/abs/2201.11903)、[Self-Consistency 论文（arXiv:2203.11171）](https://arxiv.org/abs/2203.11171)、[ReAct 论文（arXiv:2210.03629）](https://arxiv.org/abs/2210.03629)、[Tree of Thoughts 论文（arXiv:2305.10601）](https://arxiv.org/abs/2305.10601)、[Plan-and-Solve Prompting 论文（arXiv:2305.04091）](https://arxiv.org/abs/2305.04091)、[ReWOO 论文（arXiv:2305.18323）](https://arxiv.org/abs/2305.18323)、[Least-to-Most Prompting 论文（arXiv:2205.10625）](https://arxiv.org/abs/2205.10625)、[LangGraph / LangChain Agents 官方文档](https://docs.langchain.com/oss/python/langchain-agents)、[OpenAI “Learning to reason with LLMs”](https://openai.com/index/learning-to-reason-with-llms/) 与 [Lilian Weng《LLM Powered Autonomous Agents》](https://lilianweng.github.io/posts/2023-06-23-agent/)。检索日期为 2026-08-24。仓库内另保留 `资料来源.md` 作为维护清单，不计入正文页面。

三层引用边界贯穿全章：**官方公开机制**指论文和文档明确写出的外部行为；**通用工程模式**指从公开行为提炼、可迁移到自己 Agent 的做法；**教学参考实现**指本章为了可运行、可测试而构造的代码，不复刻任何闭源实现。凡是会随版本变化的数字（模型窗口、思考预算、价格），都以链接中的当前官方页面为准，本章不把某次检索时的数值写成永久承诺。
