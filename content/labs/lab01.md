    <section class="chapter" id="lab1">
      <h2 class="chap-title"><span class="kicker">L1</span>Lab 1：不用框架，裸写一个 Agent</h2>
      <p class="cjk">理解 Agent 最好的方式，是<mark class="key">先把框架全部拿掉</mark>，用最原始的循环手写一遍。这个 Lab 只依赖一个 LLM 接口，实现一个能做算术和查天气的 ReAct Agent。跑通它，你就彻底看懂了第 3 章说的"思考—行动—观察循环"到底是什么——所有框架无非是把这段代码包装得更漂亮。</p>

      <p class="cjk"><strong>核心思想</strong>：Agent = 一个 <code>while</code> 循环 + 一个会"输出下一步动作"的模型 + 一组工具。模型每轮吐出"要调用哪个工具、参数是什么"，我们执行它、把结果喂回去，直到模型说"我可以回答了"。就这么简单。</p>

      <div class="code-label">Python · 第 1 步：定义工具与提示词协议</div>
      <pre><code><span class="kw">import</span> json, re
<span class="kw">from</span> openai <span class="kw">import</span> OpenAI

client = OpenAI(base_url=<span class="st">"https://api.your-llm.com/v1"</span>, api_key=<span class="st">"sk-..."</span>)

<span class="cm"># 1) 工具就是普通 Python 函数</span>
<span class="kw">def</span> <span class="fn">calculator</span>(expression: str) -> str:
    <span class="kw">return</span> str(eval(expression, {<span class="st">"__builtins__"</span>: {}}))   <span class="cm"># 生产要换成安全求值</span>

<span class="kw">def</span> <span class="fn">get_weather</span>(city: str) -> str:
    fake = {<span class="st">"北京"</span>: <span class="st">"晴 26℃"</span>, <span class="st">"上海"</span>: <span class="st">"多云 24℃"</span>}
    <span class="kw">return</span> fake.get(city, <span class="st">"暂无数据"</span>)

TOOLS = {<span class="st">"calculator"</span>: calculator, <span class="st">"get_weather"</span>: get_weather}

<span class="cm"># 2) 用提示词约定模型的"动作协议"——这就是 ReAct 的骨架</span>
SYSTEM = <span class="st">"""你是一个会使用工具的 Agent。每一步只能输出一个 JSON：
- 需要调用工具：{"thought": "...", "action": "工具名", "args": {...}}
- 可以给出答案：{"thought": "...", "final": "最终回答"}
可用工具：
- calculator(expression): 计算数学表达式
- get_weather(city): 查询城市天气
只输出 JSON，不要有多余文字。"""</span></code></pre>

      <p class="cjk"><strong>第 2 步 · 主循环。</strong>下面这十几行就是 Agent 的心脏。注意三个生产级细节：<code>max_steps</code> 防死循环（第 1 章的 MAX_STEPS）、把每步观察追加进消息历史（这就是"上下文"）、解析失败要兜底而不是崩溃：</p>
      <div class="code-label">Python · 第 2 步：ReAct 主循环（Agent 的心脏）</div>
      <pre><code><span class="kw">def</span> <span class="fn">run_agent</span>(question, max_steps=6):
    messages = [{<span class="st">"role"</span>: <span class="st">"system"</span>, <span class="st">"content"</span>: SYSTEM},
                {<span class="st">"role"</span>: <span class="st">"user"</span>, <span class="st">"content"</span>: question}]

    <span class="kw">for</span> step <span class="kw">in</span> range(max_steps):        <span class="cm"># ← 步数上限：防止无限循环烧钱</span>
        reply = client.chat.completions.create(
            model=<span class="st">"gpt-4o-mini"</span>, messages=messages, temperature=0
        ).choices[0].message.content

        <span class="kw">try</span>:
            act = json.loads(re.search(<span class="st">r"\{.*\}"</span>, reply, re.S).group())
        <span class="kw">except</span> Exception:
            <span class="kw">return</span> <span class="st">f"[解析失败] 模型输出：{reply}"</span>   <span class="cm"># ← 兜底，别让脏输出崩掉</span>

        <span class="kw">if</span> <span class="st">"final"</span> <span class="kw">in</span> act:                 <span class="cm"># 模型认为可以收尾了</span>
            <span class="kw">return</span> act[<span class="st">"final"</span>]

        <span class="cm"># 执行工具 → 把观察结果喂回上下文（这就是"观察"步）</span>
        name, args = act[<span class="st">"action"</span>], act.get(<span class="st">"args"</span>, {})
        obs = TOOLS[name](**args) <span class="kw">if</span> name <span class="kw">in</span> TOOLS <span class="kw">else</span> <span class="st">f"无此工具:{name}"</span>
        messages.append({<span class="st">"role"</span>: <span class="st">"assistant"</span>, <span class="st">"content"</span>: reply})
        messages.append({<span class="st">"role"</span>: <span class="st">"user"</span>, <span class="st">"content"</span>: <span class="st">f"观察结果：{obs}"</span>})

    <span class="kw">return</span> <span class="st">"[达到步数上限] 未能在限定步数内完成。"</span>   <span class="cm"># ← 优雅降级</span>

<span class="kw">if</span> __name__ == <span class="st">"__main__"</span>:
    print(<span class="fn">run_agent</span>(<span class="st">"北京今天多少度？如果比 20 度高，就算一下高出多少。"</span>))
    <span class="cm"># Agent 会：查天气→拿到 26℃→算 26-20→回答"高出 6 度"</span></code></pre>

      <div class="callout tip">
        <span class="label">你刚刚亲手实现了什么</span>
        <span class="cjk">这不到 40 行代码里，藏着 Agent 的全部本质：<strong>① 感知—决策—行动循环</strong>（第 1 章的 π/oₜ/aₜ）；<strong>② 工具调用</strong>（把模型的文本决策翻译成真实函数执行）；<strong>③ 上下文累积</strong>（每步观察追加进 messages）；<strong>④ 终止条件与降级</strong>（max_steps + 解析兜底）。smolagents、LangGraph 做的事，本质就是把这段循环工程化、加上重试、追踪、并行——但内核就是你写的这个 while 循环。<mark class="key">看懂这一点，你就再也不会被任何框架"唬住"了。</mark></span>
      </div>
      <div class="callout warn">
        <span class="label">动手改坏它</span>
        <span class="cjk">把 <code>max_steps</code> 删掉、再问一个它答不上来的问题，看它如何陷入无限循环反复调用工具——这就是第 12 章"失败模式"里的<strong>死循环</strong>活生生的样子。再把 <code>eval</code> 直接暴露给用户输入，想想第 20 章的<strong>沙箱</strong>为什么是红线。</span>
      </div>
    </section>

    <!-- LAB 2 -->
