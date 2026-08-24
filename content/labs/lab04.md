    <section class="chapter" id="lab4">
      <h2 class="chap-title"><span class="kicker">L4</span>Lab 4：多 Agent 研究助手</h2>
      <p class="cjk">最后一个 Lab 挑战最有争议的架构：<mark class="key">多 Agent</mark>。我们做一个研究助手——编排者（orchestrator）把一个大问题拆成若干子主题，<strong>并行</strong>派给多个研究员子 Agent，最后由汇总者写成报告。跑通它，你会亲身体会第 7 章讲的多 Agent 的<strong>收益</strong>（并行提速、职责隔离）与<strong>代价</strong>（token 成倍、协调复杂）。</p>

      <div class="callout warn">
        <span class="label">先记住这条判断</span>
        <span class="cjk">正如第 7 章"多 Agent 之争"所述：<strong>多 Agent 不是更高级，而是一种昂贵且有前提的权衡</strong>。只有当任务能拆成<em>相互独立、可并行</em>的子任务时才划算。本 Lab 的"研究不同子主题"恰好满足这个前提——这也是为什么它是多 Agent 的经典正例。</span>
      </div>

      <div class="code-label">Python · 第 1 步：定义一个可复用的子 Agent</div>
      <pre><code><span class="kw">import</span> asyncio
<span class="kw">from</span> openai <span class="kw">import</span> AsyncOpenAI

client = AsyncOpenAI(base_url=<span class="st">"https://api.your-llm.com/v1"</span>, api_key=<span class="st">"sk-..."</span>)

<span class="kw">async def</span> <span class="fn">llm</span>(system, user):
    r = <span class="kw">await</span> client.chat.completions.create(
        model=<span class="st">"gpt-4o-mini"</span>, temperature=0.3,
        messages=[{<span class="st">"role"</span>: <span class="st">"system"</span>, <span class="st">"content"</span>: system},
                  {<span class="st">"role"</span>: <span class="st">"user"</span>, <span class="st">"content"</span>: user}])
    <span class="kw">return</span> r.choices[0].message.content

<span class="kw">async def</span> <span class="fn">researcher</span>(subtopic):
    <span class="st">"""研究员子 Agent：专注调研一个子主题。"""</span>
    <span class="kw">return</span> <span class="kw">await</span> <span class="fn">llm</span>(
        <span class="st">"你是领域研究员，就给定子主题给出 3 条要点，简洁准确。"</span>,
        <span class="st">f"子主题：{subtopic}"</span>)</code></pre>

      <p class="cjk"><strong>第 2 步 · 编排者：拆解 → 并行 → 汇总。</strong>整个多 Agent 系统的精髓就在这三步。特别注意 <code>asyncio.gather</code>——它让多个研究员<mark class="key2">同时开工</mark>而非排队，把"耗时求和"变成"耗时取最大值"，这就是第 20 章说的并行降延迟：</p>
      <div class="code-label">Python · 第 2 步：编排者协调多个子 Agent</div>
      <pre><code><span class="kw">async def</span> <span class="fn">orchestrator</span>(question):
    <span class="cm"># ① 拆解：让编排者把大问题分解为可并行的子主题</span>
    plan = <span class="kw">await</span> <span class="fn">llm</span>(
        <span class="st">"把用户的研究问题拆成 3 个互相独立的子主题，每行一个，不要编号。"</span>,
        question)
    subtopics = [s.strip() <span class="kw">for</span> s <span class="kw">in</span> plan.splitlines() <span class="kw">if</span> s.strip()][:3]

    <span class="cm"># ② 并行派发：三个研究员同时开工（关键的降延迟手段）</span>
    findings = <span class="kw">await</span> asyncio.gather(*[<span class="fn">researcher</span>(s) <span class="kw">for</span> s <span class="kw">in</span> subtopics])

    <span class="cm"># ③ 汇总：把各路发现合成一篇结构化报告</span>
    material = <span class="st">"\n\n"</span>.join(<span class="st">f"## {t}\n{f}"</span> <span class="kw">for</span> t, f <span class="kw">in</span> zip(subtopics, findings))
    report = <span class="kw">await</span> <span class="fn">llm</span>(
        <span class="st">"你是主编，把以下研究材料整合成一篇条理清晰的简报，去重并给出结论。"</span>,
        material)
    <span class="kw">return</span> report

<span class="kw">if</span> __name__ == <span class="st">"__main__"</span>:
    print(asyncio.run(<span class="fn">orchestrator</span>(<span class="st">"评估 RAG 与长上下文两条技术路线的取舍"</span>)))</code></pre>

      <div class="callout tip">
        <span class="label">你亲历的收益与代价</span>
        <span class="cjk"><strong>收益</strong>：三个子主题<em>并行</em>调研，总耗时约等于最慢的那一个，而不是三者之和；每个研究员上下文干净、职责单一，不会互相干扰。<strong>代价</strong>：这一个问题触发了 <strong>1（拆解）+ 3（研究）+ 1（汇总）= 5 次</strong>模型调用，token 消耗是单 Agent 的数倍——这就是 Anthropic 所说的"多 Agent 约 15× token"的微缩版。<mark class="key">跑一遍你就懂了：多 Agent 的每一分性能提升，都是用真金白银的 token 换来的</mark>。所以第 7 章才反复强调：先问"这任务真的需要拆吗"，再决定要不要上多 Agent。</span>
      </div>
      <div class="callout warn">
        <span class="label">动手改坏它</span>
        <span class="cjk">把 <code>asyncio.gather</code> 改成 <code>for</code> 循环串行调用，计时对比——你会直观看到并行省了多少墙钟时间。再让子主题<em>相互依赖</em>（比如后一个要用到前一个的结论），你会发现并行架构立刻失效、结果开始矛盾——这正是第 7 章"动作背后的隐含决策一冲突就崩"的活教材。</span>
      </div>

      <div class="callout tip">
        <span class="label">四个 Lab 串起来，你已经走完了一条完整的成长路径</span>
        <span class="cjk">从 Lab 1 的<strong>裸循环</strong>（看懂本质）→ Lab 2 的<strong>Agentic RAG</strong>（接入真实知识）→ Lab 3 的<strong>结构化 + 工具</strong>（做到生产可消费）→ Lab 4 的<strong>多 Agent 编排</strong>（理解规模与代价），你不仅读过、更亲手跑过了 Agent 工程的主干。把这四个项目放进你的 GitHub，面试时它们就是最有说服力的"我真的做过"。</span>
      </div>
    </section>

  </div><!-- /page -->

