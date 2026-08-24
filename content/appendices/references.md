  <footer id="references">
    <div class="sources">
      <h2>参考来源</h2>
      <ol>
        <li id="cite-1">
          <span class="src-title">Anthropic Engineering — Effective context engineering for AI agents（上下文工程定义、上下文腐烂、压缩/笔记/子代理三种长任务技术，以及"简单可组合优于复杂框架"的结论）。</span>
          <a class="src-url" href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" target="_blank" rel="noopener">https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents</a>
        </li>
        <li id="cite-2">
          <span class="src-title">Anthropic Engineering — Building Effective Agents（Agent 定义：代表用户自主执行工作流；Agent 与 Workflow 的区分）。</span>
          <a class="src-url" href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noopener">https://www.anthropic.com/engineering/building-effective-agents</a>
        </li>
        <li id="cite-3">
          <span class="src-title">Anthropic Engineering — Building Effective Agents（"多数场景下 Workflow 比 Agent 更简单、便宜、可靠、易调试"，先评估是否需要 Agent 的工程共识）。</span>
          <a class="src-url" href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noopener">https://www.anthropic.com/engineering/building-effective-agents</a>
        </li>
        <li id="cite-4">
          <span class="src-title">Anthropic Engineering — Building Effective Agents（Agent 核心构件与执行循环；"多智能体只在任务可并行或需不同提示词/工具集时才用"的建议）。</span>
          <a class="src-url" href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noopener">https://www.anthropic.com/engineering/building-effective-agents</a>
        </li>
        <li id="cite-5">
          <span class="src-title">Chroma Research — Context Rot: How Increasing Input Tokens Impacts LLM Performance（上下文腐烂：token 增多导致回忆准确率下降的实证研究）。</span>
          <a class="src-url" href="https://research.trychroma.com/context-rot" target="_blank" rel="noopener">https://research.trychroma.com/context-rot</a>
        </li>
        <li id="cite-6">
          <span class="src-title">LangChain Blog — Context Engineering for Agents（Write / Select / Compress / Isolate 四大策略；长期记忆的语义/情景/程序三分类；热路径 vs 后台写入）。</span>
          <a class="src-url" href="https://blog.langchain.com/context-engineering-for-agents/" target="_blank" rel="noopener">https://blog.langchain.com/context-engineering-for-agents/</a>
        </li>
        <li id="cite-7">
          <span class="src-title">Model Context Protocol 官方文档 — Introduction（MCP 开放标准定义、"AI 应用的 USB-C 接口"比喻、Host/Client/Server 架构与 Tools/Resources/Prompts 能力）。</span>
          <a class="src-url" href="https://modelcontextprotocol.io/introduction" target="_blank" rel="noopener">https://modelcontextprotocol.io/introduction</a>
        </li>
        <li id="cite-8">
          <span class="src-title">Anthropic Engineering — Building Effective Agents（"先用最简单方案，只在必要时增加复杂度；生产中常需减少抽象层、直接用底层 API"的忠告）。</span>
          <a class="src-url" href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noopener">https://www.anthropic.com/engineering/building-effective-agents</a>
        </li>
        <li id="cite-9">
          <span class="src-title">Hugging Face — smolagents 仓库与文档（核心逻辑约千行；CodeAgent 让 LLM 以 Python 代码作为行动，较 JSON 工具调用减少约 30% 步骤并在困难基准上表现更好）。</span>
          <a class="src-url" href="https://github.com/huggingface/smolagents" target="_blank" rel="noopener">https://github.com/huggingface/smolagents</a>
        </li>
        <li id="cite-10">
          <span class="src-title">PydanticAI 官方文档（类型安全的 Agent 框架，由 Pydantic 团队打造，主打结构化输出、依赖注入与生产级工程化，"Agent 界的 FastAPI"）。</span>
          <a class="src-url" href="https://ai.pydantic.dev/" target="_blank" rel="noopener">https://ai.pydantic.dev/</a>
        </li>
        <li id="cite-11">
          <span class="src-title">Ouyang et al. — InstructGPT: Training language models to follow instructions with human feedback（SFT + RLHF 后训练的奠基论文，ChatGPT 的技术路线来源）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2203.02155" target="_blank" rel="noopener">https://arxiv.org/abs/2203.02155</a>
        </li>
        <li id="cite-12">
          <span class="src-title">Rafailov et al. — Direct Preference Optimization (DPO)（免奖励模型、直接在偏好对上优化策略，等价于隐式奖励的偏好对齐方法）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2305.18290" target="_blank" rel="noopener">https://arxiv.org/abs/2305.18290</a>
        </li>
        <li id="cite-13">
          <span class="src-title">DeepSeek-AI — DeepSeek-R1（GRPO 组相对策略优化 + 可验证奖励训练长链推理能力的技术报告）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2501.12948" target="_blank" rel="noopener">https://arxiv.org/abs/2501.12948</a>
        </li>
        <li id="cite-14">
          <span class="src-title">Dettmers et al. — QLoRA: Efficient Finetuning of Quantized LLMs（4-bit 量化 + LoRA，让单卡也能微调数十亿参数模型的参数高效微调方法）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2305.14314" target="_blank" rel="noopener">https://arxiv.org/abs/2305.14314</a>
        </li>
        <li id="cite-15">
          <span class="src-title">Wang et al. — Executable Code Actions Elicit Better LLM Agents (CodeAct)（以可执行代码作为动作空间比 JSON/文本工具调用更高效、成功率更高）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2402.01030" target="_blank" rel="noopener">https://arxiv.org/abs/2402.01030</a>
        </li>
        <li id="cite-16">
          <span class="src-title">Mialon et al. — GAIA: a benchmark for General AI Assistants（466 题三层难度，人类约 92% vs GPT-4+插件约 15% 的能力鸿沟）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2311.12983" target="_blank" rel="noopener">https://arxiv.org/abs/2311.12983</a>
        </li>
        <li id="cite-17">
          <span class="src-title">SWE-bench 官网（真实 GitHub issue 修复基准；Verified 子集为 500 道经人工校验任务，编码 Agent 的主流标尺）与 OSWorld 项目主页（真实操作系统 GUI 任务，人类约 72%）。</span>
          <a class="src-url" href="https://www.swebench.com/" target="_blank" rel="noopener">https://www.swebench.com/</a>
        </li>
        <li id="cite-18">
          <span class="src-title">Yao et al. — τ-bench: A Benchmark for Tool-Agent-User Interaction（首创 pass^k 衡量多次一致性，暴露"能成一次≠稳定可用"）与 HumanLayer 12-Factor Agents（生产可靠性工程原则）。</span>
          <a class="src-url" href="https://arxiv.org/abs/2406.12045" target="_blank" rel="noopener">https://arxiv.org/abs/2406.12045</a>
        </li>
      </ol>
    </div>
