2026 年 8 月检索更新。本章沿用全书三层标注约定：把厂商文档明确描述的行为称为「官方公开机制」；把可从公开行为推导、能迁移到自建系统的做法称为「通用工程模式」；把书内为讲清原理而构造、可离线运行的代码称为「教学参考实现」。三者在正文里始终分层标注，不把推导写成产品承诺，也不臆造厂商内部实现、私有算法或未公开数字。

## 一次「离线 95、线上 71」的真实落差

设想一个电商客服 Agent，2026 年 3 月上线前的离线验收报告很漂亮：在 800 条评估样本上，回答质量由一个大模型裁判（LLM-as-a-judge，让大模型给回答打分或比较）打分，平均 4.6 分（满分 5），通过率 95%。团队据此放量。上线第二周，人工抽检却发现真实满意度只有 71%，差了整整 24 个百分点。复盘挖出四条独立病根，每一条都对应本章一个小节：其一，裁判存在长度偏差（Length Bias），把啰嗦但没解决问题的回答判了高分；其二，评估集在调 prompt 时被反复「看过」，发生了优化泄漏，离线分虚高；其三，团队只看了「结果对不对」，从没评过「中间调用了哪些工具、顺序对不对」这条轨迹，于是「先承诺退款再查政策」这种危险顺序在离线完全隐形；其四，裁判从未与人工标注对齐过，没人算过它和人类的一致性到底有多高。

这四条病根不是「模型不够聪明」，而是评估体系本身的工程环节没做扎实——**裁判没校准、评估集会泄题、轨迹没评、离线到线上没有过渡带**。本章就是来趟这几摊浑水的。它是第 16 章「评估基础」的进阶篇：第 16 章讲清了「为什么必须评估、结果 vs 轨迹两个维度、标准答案与 LLM 裁判入门」；本章不再重复这些地基，而是专攻深水区——**裁判自己就有偏见怎么办、评估集悄悄泄题怎么发现、离线跑得漂亮线上却翻车中间那道鸿沟怎么填**。

## 你将得到什么

- 能把「轨迹好不好」拆成工具选择、参数、顺序、步数效率四个**可写成断言**的维度，并写出纯规则的轨迹评估器（无需大模型）。
- 能讲清并实现 G-Eval（一种基于思维链 Chain-of-Thought，CoT 的 LLM 裁判评分框架）的两段式流程，以及 rubric（评分量表）如何把「好」拆成可判定条款。
- 能实现成对比较（Pairwise Comparison）并汇总成胜率（win rate），说清它为什么比绝对打分更稳。
- 能识别并**量化**裁判的三大系统性偏差（位置、长度、自我偏好），并用双向评测、长度去偏、异族裁判把它们校准掉。
- 能用一致率与 Cohen's Kappa（科恩卡帕系数）量化「裁判到底有多可信」，并知道阈值怎么读。
- 能设计一条贯穿「离线 held-out 门禁 → 影子流量 → A/B 显著性 → 灰度」的评估管线，并用双比例 z 检验判断「涨的 3 个点是真本事还是噪声」。
- 能合成多样化评估集并做污染追踪（contamination tracking），避免「模型一升级，评估分就莫名其妙变好」的假象。

## 小节地图

1. [轨迹级评估：从结果到过程的可断言维度](/advanced/chapter-28/s01/)
2. [LLM 裁判深入与 rubric 设计（G-Eval 两段式）](/advanced/chapter-28/s02/)
3. [成对比较与胜率：为什么人类更擅长比较](/advanced/chapter-28/s03/)
4. [裁判的三大系统性偏差与去偏](/advanced/chapter-28/s04/)
5. [裁判校准：与人工一致性与 Cohen's Kappa](/advanced/chapter-28/s05/)
6. [离线与在线评估管线：从 held-out 到影子流量与 A/B](/advanced/chapter-28/s06/)
7. [合成评估集生成与污染追踪](/advanced/chapter-28/s07/)
8. [评估进阶的生产踩坑与思考回答](/advanced/chapter-28/s08/)

## 贯穿案例与贯穿数据

后续所有小节复用同一条可复核的数据链，围绕开头「离线 95、线上 71」的电商客服 Agent 展开。它有一个固定的工具集与一条评估样本，全章反复用它做最小演示：
```text
被评估对象：电商客服 Agent（工具集 3 个）
query_order(id)     只读查单，无副作用
check_policy(id)    只读查退款政策，无副作用
do_refund(id,amt)   写操作：登记退款，有副作用（评估时须 mock）

一条贯穿评估样本：
输入   ：用户说「订单 A123 想退款」
黄金轨迹：query_order(A123) -> check_policy(A123) -> do_refund(A123, 88)
红线   ：do_refund 绝不能早于 check_policy（先查政策再退款）
黄金回答：「已为您登记退款，预计 3 个工作日到账。」

四类评估会轮番作用在它身上：
· 轨迹评估（第1节）：查工具/参数/顺序/步数
· LLM 裁判打分（第2节）+ 成对比较（第3节）：评回答质量
· 偏差与校准（第4/5节）：证明裁判本身可信
· 离线/在线管线（第6节）+ 合成集（第7节）：从验收走到线上
```
优化前，团队只用一个裁判给「最终回答」打分；优化后，规则先评轨迹当快检、异族裁判评开放输出并做过双向去偏与 Kappa 校准、评估集按事件哈希切分并锁死 held-out、上线走影子流量与 A/B。输出「看起来分高」不是判据——**关键是这套评估能证明它自己可信**。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，把本章三条最反直觉的结论固化成断言：系统性偏差无法靠多采样平均掉；一致率会因类别失衡而虚高；成对比较必须双向取一致才可信。
```python
"""README 热身脚本：确认解释器可用，并固化本章三条评估不变量。"""
from __future__ import annotations
import sys


def systematic_bias_stays(samples: int = 100000) -> bool:
    # 位置偏差是常量偏移 +0.3，无论采多少次，均值仍偏离 0
    biased = [0.3 for _ in range(samples)]
    return abs(sum(biased) / len(biased)) > 0.01  # 仍然偏，无法被平均掉


def agreement_can_lie() -> bool:
    # 9 成样本是 good，裁判无脑全 good：一致率高但毫无鉴别力
    human = ["good"] * 9 + ["bad"]
    judge = ["good"] * 10
    return sum(j == h for j, h in zip(judge, human)) / 10 >= 0.9  # 虚高


def pairwise_needs_two_way() -> bool:
    # 交换顺序后仍选前面 -> 两次结论不一致，说明需要双向校验
    first, second = "A", "A"
    second_mapped = "A" if second == "B" else "B"
    return first != second_mapped


def run() -> None:
    print(f"Python={sys.version_info.major}.{sys.version_info.minor}")
    print(f"系统性偏差无法被平均掉={systematic_bias_stays()}")
    print(f"一致率会虚高={agreement_can_lie()}")
    print(f"成对比较需双向取一致={pairwise_needs_two_way()}")
    print("热身通过：可以开始阅读本章")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch28.py`，运行 `python warmup_ch28.py`。预期输出：
```text
Python=3.10
系统性偏差无法被平均掉=True
一致率会虚高=True
成对比较需双向取一致=True
热身通过：可以开始阅读本章
```
Python 小版本可能不同，但需不低于 3.10。这三个 `True` 分别对应第 4 节（偏差不能平均掉）、第 5 节（一致率会骗你）、第 3/4 节（成对比较要双向），是全章反复用到的直觉锚点。

## 阅读约定与来源

正文只引用可公开核验的一手资料，用 `[来源](url)` 内联标注：G-Eval 的思维链评分框架与「form-filling」两段式，见 DeepEval 官方文档与其原始论文解读 [来源](https://deepeval.com/docs/metrics-llm-evals) [来源](https://www.confident-ai.com/blog/g-eval-the-definitive-guide)；LangSmith 关于离线/在线评估、LLM 裁判评估器与成对评估（含 `randomize_order` 缓解位置偏差）的说明 [来源](https://docs.smith.langchain.com/evaluation/concepts) [来源](https://docs.smith.langchain.com/evaluation/how_to_guides/evaluate_pairwise)；Anthropic 关于「用真实数据与复杂任务生成评估集、让 Agent 跑完整工具循环、记录时间/调用数/token/错误类型」的工具开发与评估方法 [来源](https://www.anthropic.com/engineering/writing-tools-for-agents)；以及 Anthropic《Building Effective Agents》里「保持简单、透明、把评估放在闭环」的工程主张 [来源](https://www.anthropic.com/engineering/building-effective-agents)。检索日期为 2026-08-24。

涉及会变化的细节（模型标识、上下文窗口、价格、平台 UI、SDK（Software Development Kit，软件开发工具包）方法名、具体阈值）一律以链接中的当前官方文档为准；本章讲稳定的评估方法论，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页问题定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 离线分高、线上崩 | 评估集泄漏 + 裁判有偏且未校准 | 对比离线通过率与线上人工抽检率 | 锁死 held-out + 裁判先算 Kappa 再用 | 分布确实剧变时需重建评估集 |
| 只评结果、不评轨迹 | 缺轨迹级断言 | 回放危险顺序看结果是否照样通过 | 加工具/参数/顺序/步数四维断言 | 开放推理任务轨迹无标准答案 |
| 裁判分随回答变长而升 | 长度偏差未度量 | 造等质量不同长度样本看相关性 | rubric 声明「简洁也可满分」+ 长度去偏 | 任务本就要求详尽时另设 |
| 模型升级评估分「变好」 | 评估集被污染、无版本追踪 | 给评估集打 hash/版本比对 | 版本化 + 污染检查 + 定期重建 | 全新能力确有提升时属真改善 |
