    <section class="chapter" id="lab3">
      <h2 class="chap-title"><span class="kicker">L3</span>Lab 3：带工具的客服 Agent（PydanticAI）</h2>
      <p class="cjk">前两个 Lab 的输出都是自由文本，但真实业务系统需要<mark class="key">结构化、可被程序消费的输出</mark>——订单状态要能存进数据库、退款金额要能触发支付。这个 Lab 用 PydanticAI 做一个客服 Agent：它能查订单、发起退款，并始终返回<strong>类型安全</strong>的结构化结果。这正是第 9 章"工程化"和第 6 章"工具"的合体落地。</p>

      <div class="callout tip">
        <span class="label">依赖</span>
        <span class="cjk"><code>pip install "pydantic-ai==2.33.*"</code>。PydanticAI 被称为"Agent 界的 FastAPI"，主打用 Pydantic 模型约束输出结构、用依赖注入传递上下文（如数据库连接、当前用户）。<mark class="key2">注意 2.x 里最终产物用 <code>result.output</code> 取（旧版本是 <code>result.data</code>），升级时容易踩这个改名。</mark></span>
      </div>

      <div class="code-label">Python · 第 1 步：定义结构化输出与依赖</div>
      <pre><code><span class="kw">from</span> dataclasses <span class="kw">import</span> dataclass
<span class="kw">from</span> pydantic <span class="kw">import</span> BaseModel, Field
<span class="kw">from</span> pydantic_ai <span class="kw">import</span> Agent, RunContext

<span class="cm"># 1) 用 Pydantic 模型规定 Agent 最终必须产出的结构（类型安全的关键）</span>
<span class="kw">class</span> <span class="fn">SupportReply</span>(BaseModel):
    answer: str = Field(description=<span class="st">"给用户的自然语言回复"</span>)
    action_taken: str = Field(description=<span class="st">"执行的动作：none/refunded/escalated"</span>)
    need_human: bool = Field(description=<span class="st">"是否需要转人工"</span>)

<span class="cm"># 2) 依赖注入：把数据库/当前用户等运行时上下文传进工具</span>
<span class="kw">@dataclass</span>
<span class="kw">class</span> <span class="fn">Deps</span>:
    user_id: str
    db: dict          <span class="cm"># 这里用 dict 模拟订单库</span></code></pre>

      <div class="code-label">Python · 第 2 步：注册工具并约束行为</div>
      <pre><code>support_agent = Agent(
    <span class="st">"openai:gpt-4o-mini"</span>,
    deps_type=Deps,
    output_type=SupportReply,          <span class="cm"># ← 强制结构化输出</span>
    system_prompt=(
        <span class="st">"你是电商客服。先用工具查证事实再回复。"</span>
        <span class="st">"退款金额超过 500 元时不要直接退款，设 need_human=True 转人工。"</span>
    ),
)

<span class="kw">@support_agent.tool</span>
<span class="kw">def</span> <span class="fn">query_order</span>(ctx: RunContext[Deps], order_id: str) -> str:
    <span class="st">"""查询订单状态与金额。"""</span>
    o = ctx.deps.db.get(order_id)
    <span class="kw">return</span> str(o) <span class="kw">if</span> o <span class="kw">else</span> <span class="st">"订单不存在"</span>

<span class="kw">@support_agent.tool</span>
<span class="kw">def</span> <span class="fn">refund</span>(ctx: RunContext[Deps], order_id: str, amount: float) -> str:
    <span class="st">"""对指定订单发起退款。"""</span>
    <span class="kw">if</span> amount &gt; 500:
        <span class="kw">return</span> <span class="st">"金额超限，需人工审批"</span>          <span class="cm"># 工具层也兜一道，双保险</span>
    ctx.deps.db[order_id][<span class="st">"status"</span>] = <span class="st">"refunded"</span>
    <span class="kw">return</span> <span class="st">"退款成功"</span></code></pre>

      <div class="code-label">Python · 第 3 步：运行，拿到可直接入库的结构化结果</div>
      <pre><code>db = {<span class="st">"A1001"</span>: {<span class="st">"status"</span>: <span class="st">"paid"</span>, <span class="st">"amount"</span>: 199.0}}
deps = Deps(user_id=<span class="st">"u_42"</span>, db=db)

r = support_agent.run_sync(<span class="st">"我的订单 A1001 想退款"</span>, deps=deps)
print(r.output)
<span class="cm"># SupportReply(answer='已为您的订单 A1001 退款 199 元…',</span>
<span class="cm">#              action_taken='refunded', need_human=False)</span>
print(r.output.need_human)   <span class="cm"># False —— 可直接用于程序分支判断</span></code></pre>

      <div class="callout tip">
        <span class="label">为什么"结构化输出"是生产的分水岭</span>
        <span class="cjk">Lab 1/2 返回一段文本，人能看，但程序难以可靠地"接住"。这个 Lab 的 <code>output_type=SupportReply</code> 让 Agent 的产物变成一个<strong>带类型、可校验、可直接消费</strong>的对象——<code>need_human</code> 能直接接工单系统，<code>action_taken</code> 能直接写审计日志。这就是第 9 章反复强调的：<mark class="key">生产级 Agent 的输出必须能被系统的其余部分安全地依赖</mark>。同时注意本 Lab 演示了"双层防线"——系统提示里说了超 500 转人工，工具函数里又兜了一道，这正是第 12/20 章"别只靠提示层"的实践。</span>
      </div>
    </section>

    <!-- LAB 4 -->
