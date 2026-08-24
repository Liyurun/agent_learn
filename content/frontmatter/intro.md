    <section class="chapter" id="intro">
      <h2 class="chap-title"><span class="kicker">00</span>导读：如何使用这份宝典</h2>
      <p class="cjk">这份宝典的目标只有一个：<mark class="key">让你既能真正理解 Agent 的工作原理，又能在面试中讲清楚、写得出、答得好</mark>。它不是资源链接的堆砌，而是一条从"是什么"到"怎么做"再到"如何拿 offer"的完整路径。</p>
      <p class="cjk">我们刻意避开了重量级编排框架作为教学主线。Anthropic 工程团队在总结了大量落地案例后得出一个反直觉的结论：<mark class="key2">最成功的 Agent 实现，用的往往是简单、可组合的模式，而不是复杂的框架或专用库</mark><sup><a href="#cite-1">[1]</a></sup>。因此本宝典以极简的 <strong>smolagents</strong> 讲透原理，以类型安全的 <strong>PydanticAI</strong> 讲清工程化，再把 LangGraph、CrewAI 作为"重型编排"的对比案例来理解——学完你会明白：<em>什么时候才真的需要一个重框架</em>。</p>

      <div class="card-grid">
        <div class="card">
          <h4>🌱 零基础入门</h4>
          <p>按顺序读 第一篇 → 第三篇实践章，动手跑通第一个 Agent，建立完整心智模型。</p>
        </div>
        <div class="card">
          <h4>⚙️ 有基础想进阶</h4>
          <p>重点看 第二篇（上下文工程 / MCP / 选型）与 第三篇（评估与生产部署）。</p>
        </div>
        <div class="card">
          <h4>💼 冲刺面试</h4>
          <p>直接跳到 第四篇面试宝典，配合第一、二篇查漏补缺，准备好你的项目故事。</p>
        </div>
      </div>

      <!-- TOC -->
{{BOOK_TOC}}
    </section>

    <!-- ===== 大牛观点 ===== -->
