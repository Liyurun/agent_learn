    <section class="chapter" id="lab2">
      <h2 class="chap-title"><span class="kicker">L2</span>Lab 2：端到端 RAG 知识库问答</h2>
      <p class="cjk">第 10 章我们从零手写了检索、重排、生成的每个零件。这个 Lab 换个视角：<mark class="key">用 smolagents 把"检索"封装成一个工具，交给 Agent 自主编排</mark>——它自己判断要不要搜、怎么改写查询、要不要多搜几轮。这就是"检索即工具"的 Agentic RAG，也是把 Lab 1 的裸循环升级成生产可用形态的一步。</p>

      <div class="callout tip">
        <span class="label">依赖</span>
        <span class="cjk"><code>pip install "smolagents==1.26.*" sentence-transformers</code>。检索层为了聚焦主线，直接复用第 10 章那份 <code>hybrid_search</code>（向量 + BM25 + RRF）；生产中把它换成 Qdrant/Chroma 即可，思路不变。<code>CodeAgent</code> 会让模型写 Python 代码来调用工具，比 JSON 工具调用更适合多轮检索编排——这正是第 8 章讲的 CodeAct。</span>
      </div>

      <div class="code-label">Python · 第 1 步：把检索包成一个工具</div>
      <pre><code><span class="kw">from</span> smolagents <span class="kw">import</span> tool, CodeAgent, LiteLLMModel

<span class="cm"># 复用 Lab / 第 10 章建好的混合检索（此处省略索引构建）</span>
<span class="kw">from</span> my_retriever <span class="kw">import</span> hybrid_search   <span class="cm"># 返回 [Chunk(text, source), ...]</span>

<span class="kw">@tool</span>
<span class="kw">def</span> <span class="fn">search_kb</span>(query: str, k: int = 4) -> str:
    <span class="st">"""检索企业知识库，返回与 query 最相关的若干片段（含来源）。

    Args:
        query: 检索关键词或问题，可自行改写以提升命中率
        k: 返回片段数量，默认 4
    """</span>
    hits = <span class="fn">hybrid_search</span>(query, k=k)
    <span class="kw">return</span> <span class="st">"\n\n"</span>.join(<span class="st">f"[来源:{h.source}] {h.text}"</span> <span class="kw">for</span> h <span class="kw">in</span> hits)</code></pre>

      <p class="cjk"><strong>第 2 步 · 交给 Agent，附上"检索纪律"。</strong>关键不在代码量，而在系统提示里给 Agent 定的规矩——<mark class="key2">先检索再回答、答案要带来源、检索不到就说不知道</mark>。这三条把第 10 章的防幻觉思想直接写进了 Agent 的行为准则：</p>
      <div class="code-label">Python · 第 2 步：赋予 Agent 检索纪律并运行</div>
      <pre><code>RAG_RULES = <span class="st">"""你是企业知识库助手。回答任何业务问题前，必须先调用 search_kb 检索。
- 只依据检索到的片段回答，并在关键结论后标注 [来源:xxx]。
- 若一次检索不够，可改写 query 再搜（如换同义词、拆子问题）。
- 若检索结果仍不足以回答，如实说"知识库中未找到相关规定"。"""</span>

agent = CodeAgent(
    tools=[search_kb],
    model=LiteLLMModel(<span class="st">"gpt-4o-mini"</span>),
    instructions=RAG_RULES,
    max_steps=5,                 <span class="cm"># 限制多轮检索的上限</span>
)

print(agent.run(<span class="st">"出差高铁票能全额报销吗？依据哪条制度？"</span>))
<span class="cm"># Agent 自主：调用 search_kb("高铁 报销")→拿到片段→带来源作答</span>
print(agent.run(<span class="st">"公司的午餐补贴标准是多少？"</span>))
<span class="cm"># 知识库没有 → Agent 会先搜、发现无果 → 回答"未找到相关规定"</span></code></pre>

      <div class="callout tip">
        <span class="label">对比 Lab 1，你能看到什么进化</span>
        <span class="cjk">Lab 1 的循环是你手写的，Lab 2 里 smolagents 帮你把循环、解析、重试、追踪都工程化了，你只需专注两件事：<strong>把能力做成好用的工具</strong>（清晰的 docstring 就是给模型的说明书）和<strong>用系统提示定好纪律</strong>。同一个问题，naive RAG 只会检索一次；这个 Agent 却能在第一次没搜到时改写查询重搜——这正是第 10 章"检索即工具"相对"固定管线"的核心优势，你现在亲手验证了。</span>
      </div>
    </section>

    <!-- LAB 3 -->
