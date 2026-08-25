2026 年 8 月检索更新。本章把内容分成三层来标注可信度：**官方公开机制**指有厂商文档或权威论文明确支撑的行为（如 Anthropic 的 Contextual Retrieval、OpenAI 的 embedding 维度可裁剪、Ragas 的评估指标定义）；**通用工程模式**指可从公开做法推导、能迁移到自建系统的工程套路（如两阶段召回精排、RRF 融合、评估集回归）；**教学参考实现**指本书为讲清原理而构造、可离线运行、无需任何 API（Application Programming Interface，应用程序接口）Key 的代码。三层在正文里始终分开标注，不把推导写成产品承诺，也不臆造任何厂商内部实现。会变化的参数（价格、维度、上下文窗口、模型榜单名次）一律注明「以当前官方文档为准」。

RAG（Retrieval-Augmented Generation，检索增强生成）是给大模型外挂一个「可随时更新、可溯源」的开卷考试资料袋。第 5 章我们从「记忆」角度写过它的 Hello World；本章要把整条生产级检索管线的每一环——分块、embedding、混合检索、重排、查询改写、评估、Agentic RAG——逐个拆开，讲清每一环的失败模式、优化手段和如何量化它好不好。

## 一次「明明库里有、就是搜不到」的真实故障

设想一个企业客服 RAG 系统，知识库里躺着一份产品手册，白纸黑字写着「A100 显卡的最大功耗为 400 瓦」。周一上午九点，客户问「A100 功耗多少瓦？」，系统却答「大约 300 瓦左右」——编的。运维拉出检索日志复盘，发现三条独立的病：

- 第一，纯向量检索把「A100」「瓦」这类**精确关键词**语义平均掉了，召回的全是「GPU 散热」「深度学习训练」这类语义相关但没有具体数字的块。
- 第二，召回的 10 个块里只有 1 个沾边，其余 9 个是噪声，稀释了模型注意力（回顾第 5 章的「中间遗忘」）。
- 第三，就算召回不理想，prompt 里没有一句「只依据原文、查不到就说不知道」，模型于是**强行作答**，凭参数记忆编了个数字。

事后复盘：这不是「模型不够聪明」，而是 RAG 检索管线的三个工程环节没做扎实——缺混合检索、缺重排、缺忠实度约束与评估。这条故障链贯穿全章：每一小节都会回到「A100 功耗 400 瓦」这条可复核的数据，演示某一环的优化如何把它从「搜不到 / 答错」修成「搜得准 / 答得对」。

## 你将得到什么

- 能凭记忆画出生产级 RAG 六环管线（分块 → embedding → 向量库 → 检索 → 重排 → 生成），区分离线建索引与在线查询，并说清「天花板由最短的板决定」。
- 能实现并解释父子块（parent-document retrieval）、语义分块与 Contextual Retrieval，让检索粒度与生成粒度解耦。
- 能选对 embedding 模型：看懂语言 / 维度 / 输入长度 / 领域四维，理解对称 vs 非对称检索、指令前缀、Matryoshka 可裁剪维度，并记住「换模型必须重建索引」的铁律。
- 能亲手写出 BM25 + 向量的混合检索，用 RRF（Reciprocal Rank Fusion，倒数排名融合）融合两路排名，明白它为什么不看分数只看排名。
- 能实现两阶段检索：双塔（bi-encoder）召回广、交叉编码器（cross-encoder）rerank 精排准，并权衡它带来的延迟与成本。
- 能用查询改写、查询分解、HyDE（Hypothetical Document Embeddings，假设性文档嵌入）修好「问句和答案对不上」的语义鸿沟。
- 能用上下文召回率、上下文精度、忠实度、答案相关性四指标搭一张 RAG 诊断表，并跑一个可回归的离线评估集。
- 能说清 Agentic RAG 相比传统 RAG 强在哪、代价是什么、怎么防它陷入无限检索，并开出一张覆盖全链路的生产建议清单。

## 小节地图

1. [分块策略进阶：从固定切分到父子块与 Contextual Retrieval](/advanced/chapter-26/s01/)
2. [Embedding 选型与向量检索：不是维度越高越好](/advanced/chapter-26/s02/)
3. [混合检索：BM25 + 向量，用 RRF 融合两路排名](/advanced/chapter-26/s03/)
4. [重排（Rerank）：召回要广，精排要准的两阶段架构](/advanced/chapter-26/s04/)
5. [查询侧优化：查询改写、查询分解与 HyDE](/advanced/chapter-26/s05/)
6. [RAG 评估：不量化就等于闭眼调参](/advanced/chapter-26/s06/)
7. [Agentic RAG 与全链路生产踩坑思考回答](/advanced/chapter-26/s07/)

## 贯穿数据与贯穿案例

后续所有小节复用同一条可复核的数据链，围绕开头「A100 功耗 400 瓦」故障展开。知识库固定为一小组关于显卡的技术文档，其中有且仅有一句是「标准答案」：`A100 的最大功耗为 400 瓦`；测试问题固定为 `A100 功耗多少瓦`；判定标准固定为「最终答案是否命中 400 瓦、是否溯源到含该句的文档」。这样任意一节抽取其中一环做最小演示，都能对着同一条数据说清「这一环之前搜不到 / 搜得脏，这一环之后搜得准」。
```text
知识库（教学用，5 段）：
d0: A100 A100 是很热门的数据中心显卡型号        ← 精确词 A100 高频，但没有功耗数字（干扰项）
d1: 显卡的功耗需要认真管理和优化功耗            ← "功耗"高频，但没提 A100（干扰项）
d2: A100 的最大功耗为 400 瓦                    ← 唯一标准答案
d3: 深度学习训练会消耗大量电力                  ← 语义相关的噪声
d4: 限制功率上限可以让 A100 稳定运行在低功耗    ← 相关但没有具体数字

测试问题： "A100 功耗多少瓦"
标准答案块： d2
判定： 最终答案是否 = 400 瓦，且引用溯源到 d2
```
优化前，朴素 RAG 用纯向量检索 + 直接生成，d2 被干扰项挤出前排，模型编数字；优化后，混合检索让 d2 进入候选、rerank 把 d2 顶到第一、prompt 约束模型只依据原文，答案锁定 400 瓦并给出 d2 作为引用。输出「看起来像答案」不是判据——关键是答案有来源、失败可定位、每次改动可用评估集量化。

## 最小环境核验 / 热身

导读页先给一段不联网、不需要 API Key 的热身代码，用玩具「字频向量」把本章一条关键直觉固化成可见的失败：**当用户用口语提问、既不含精确型号「A100」也不含单位「瓦」时，纯向量检索会被「语义相关但不含答案」的干扰项压过标准答案。** 这正是后面要用混合检索、rerank、查询改写 / HyDE 联手治的病。
```python
from collections import Counter
import math


def embed(text: str) -> Counter:
    """玩具 embedding：字频向量（零依赖可跑，仅用于让示例输出可逐字复核）。"""
    return Counter(text)


def cosine(a: Counter, b: Counter) -> float:
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def run() -> None:
    docs = {
        "d0": "A100 A100 是很热门的数据中心显卡型号",
        "d1": "显卡的功耗需要认真管理和优化功耗",
        "d2": "A100 的最大功耗为 400 瓦",
        "d3": "深度学习训练会消耗大量电力",
        "d4": "限制功率上限可以让 A100 稳定运行在低功耗",
    }
    # 口语化查询：不含精确型号"A100"、不含单位"瓦"
    query = "这款显卡耗电大概多少"
    q = embed(query)
    ranked = sorted(docs, key=lambda i: cosine(q, embed(docs[i])), reverse=True)
    print("口语查询：", query)
    print("朴素向量检索排名：", ranked)
    print("标准答案 d2 排在第", ranked.index("d2") + 1, "位（被干扰项压下去了）")
    print("热身通过：可以开始阅读本章" if "d2" in ranked else "环境异常")


if __name__ == "__main__":
    run()
```
保存为 `warmup_ch26.py`，运行 `python warmup_ch26.py`。预期输出：
```text
口语查询： 这款显卡耗电大概多少
朴素向量检索排名： ['d1', 'd3', 'd2', 'd0', 'd4']
标准答案 d2 排在第 3 位（被干扰项压下去了）
热身通过：可以开始阅读本章
```
注意这个「不完美」的结果正是本章的起点：口语提问「这款显卡耗电大概多少」既没提「A100」也没提「瓦」，标准答案 d2 只排到第 3 位，被「功耗 / 电力」语义更浓的 d1、d3 压在下面。这暴露了纯向量检索的两个结构性软肋——**对精确关键词（A100、瓦）不敏感**，且**「语义相关」不等于「含答案」**。字频向量是刻意选的玩具把毛病放大，真实 embedding 会更聪明，但这两个矛盾在任何 embedding 上都存在，正是 26.3 混合检索、26.4 重排、26.5 查询改写要治的病。

## 阅读约定与来源

正文只引用可公开核验的一手资料，用 `[来源](url)` 内联标注。关键来源包括：Anthropic《Introducing Contextual Retrieval》（分块前给每块加上下文，配合 BM25 与 rerank，失败率最多降 67%）[来源](https://www.anthropic.com/news/contextual-retrieval)、OpenAI《Embeddings》指南（text-embedding-3 系列支持 `dimensions` 参数裁剪维度）[来源](https://platform.openai.com/docs/guides/embeddings)、Microsoft Learn《Hybrid search》（RRF 打分 `1/(k+rank)`、`k` 典型取 60）[来源](https://learn.microsoft.com/en-us/azure/documentdb/full-text-search-hybrid)、HyDE 原论文《Precise Zero-Shot Dense Retrieval without Relevance Labels》[来源](https://arxiv.org/abs/2212.10496)、Ragas 评估文档（忠实度 / 上下文精度 / 上下文召回率 / 答案相关性定义）[来源](https://docs.ragas.io/)、Lilian Weng《LLM Powered Autonomous Agents》[来源](https://lilianweng.github.io/posts/2023-06-23-agent/)、Anthropic《Building Effective Agents》[来源](https://www.anthropic.com/engineering/building-effective-agents)。检索日期为 2026-08-24。

涉及价格、embedding 维度、上下文窗口、模型榜单名次、rerank 模型名等会变化的细节，以链接中的当前官方文档为准；本章讲稳定的检索机制，不把某次检索到的数值写成永久承诺。仓库内另有 `资料来源.md` 作为维护清单，不计入正文页面。

## 导读页故障定位

| 症状 | 根因 | 如何观测与复现 | 修复与预防 | 不适用边界 |
|---|---|---|---|---|
| 明明库里有答案却答错 | 纯向量对精确词不敏感 + 无忠实度约束 | 跑热身脚本看 d2 只排第 3 | 混合检索 + rerank + prompt 约束 | 库里根本没有答案时属另一类问题 |
| 换更强 embedding 反而更差 | 换模型没重建索引 | 新查询配旧向量库比相似度 | 换 embedding 必须全量重建 | 同模型升级小版本厂商保证兼容时例外 |
| 「感觉调好了」但线上崩 | 没有评估集、凭玄学调参 | 无回归对照即为此病 | 先攒评估集再优化 | 一次性 Demo 可豁免 |
| 召回一堆噪声稀释注意力 | 召回 k 过大、无精排 | 打印 top-k 看相关比例 | rerank 精排后截断 | 极短知识库噪声天然少 |
