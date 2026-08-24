    <section class="chapter" id="labs-intro">
      <h2 class="chap-title"><span class="kicker">L0</span>实战工坊：把概念变成手感</h2>
      <p class="cjk">读懂原理和亲手跑通之间，隔着一条"手感"的鸿沟。前面 24 章讲清了"为什么"，这一篇给你四个<mark class="key">从零到能跑</mark>的完整项目，每个都能直接复制到本地、装上依赖就运行。它们刻意由浅入深、层层递进，把全书的核心概念串成一条动手主线：</p>
      <div class="card-grid">
        <div class="card">
          <h4>🧪 Lab 1 · 裸写一个 Agent</h4>
          <p>不用任何框架，纯 Python 手写 ReAct 循环，看清"思考—行动—观察"的每一次呼吸。对应第 1、3 章。</p>
        </div>
        <div class="card">
          <h4>📚 Lab 2 · 端到端 RAG 问答</h4>
          <p>把第 10 章的检索即工具落成一个可运行的知识库问答，Agent 自主决定检索与改写。对应第 10 章。</p>
        </div>
        <div class="card">
          <h4>🎧 Lab 3 · 带工具的客服 Agent</h4>
          <p>用 PydanticAI 做类型安全的结构化输出 + 多工具编排，处理订单查询与退款。对应第 6、9 章。</p>
        </div>
        <div class="card">
          <h4>🔬 Lab 4 · 多 Agent 研究助手</h4>
          <p>编排者拆解任务、并行派发给子 Agent、汇总成报告，亲历多 Agent 的收益与代价。对应第 7 章。</p>
        </div>
      </div>
      <div class="callout tip">
        <span class="label">怎么用这一篇</span>
        <span class="cjk">别只读代码，<strong>一定要跑</strong>。建议按顺序做：先用 Lab 1 建立"Agent 就是一个带工具的循环"的直觉，再逐个加检索、加结构化、加多 Agent。每跑通一个，回到对应章节重读一遍，你会发现原来抽象的概念全都"长"在代码的某一行里。跑通后试着改坏它——删掉 <code>max_steps</code>、去掉忠实度自检、把有依赖的步骤强行并行——亲眼看它怎么崩，比读十遍反模式都记得牢。</span>
      </div>
      <div class="callout tip">
        <span class="label">📎 四个 Lab 对照的官方 Quickstart 与版本基线（照着跑最稳）</span>
        <span class="cjk">下面代码为讲清骨架做了精简，<strong>能跑但非生产级</strong>；真正上手时以官方 Quickstart 为准，并锁定本书的版本基线（截至 2026 年中）以免 API 漂移：<br>
        ① <a href="https://huggingface.co/docs/smolagents/index" target="_blank" rel="noopener">smolagents 官方文档</a>（<code>pip install "smolagents==1.26.*"</code>，Lab 2 用）；<br>
        ② <a href="https://ai.pydantic.dev/" target="_blank" rel="noopener">PydanticAI 官方文档</a>（<code>pip install "pydantic-ai==2.33.*"</code>，Lab 3 用）；<br>
        ③ <a href="https://platform.openai.com/docs/api-reference/chat" target="_blank" rel="noopener">OpenAI Python SDK</a>（<code>pip install "openai&gt;=1.50"</code>，Lab 1/4 用；把 <code>base_url</code>/<code>api_key</code> 换成你自己的）。<mark class="key2">API 签名随版本变化，报错先回官方文档核对当前写法，别照抄二手博客。</mark></span>
      </div>
    </section>

    <!-- LAB 1 -->
