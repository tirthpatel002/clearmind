---
question: "How do Mem0, Zep, Letta and LangMem publicly describe their agent memory approaches?"
query: "Mem0 Zep Letta LangMem agent memory comparison"
fetchedAt: "2026-10-30T14:27:54.524Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://datapace.ai/blog/ai-agent-memory-tools-2026"
  - "https://www.puppyone.ai/en/blog/best-ai-agent-memory-platforms"
  - "https://infranodus.com/docs/llm-memory-tools-comparison"
  - "https://forum.letta.com/t/agent-memory-letta-vs-mem0-vs-zep-vs-cognee/88"
  - "https://www.cbinsights.com/company/mem0"
  - "https://www.graphlit.com/blog/survey-of-ai-agent-memory-frameworks"
  - "https://www.cbinsights.com/company/mem0/alternatives-competitors"
  - "https://mem0.ai/library/agent-memory/zep-vs-mem0-which-ai-memory-layer-should-you-choose"
---
# How do Mem0, Zep, Letta and LangMem publicly describe their agent memory approaches?


Query: `Mem0 Zep Letta LangMem agent memory comparison` (Tavily advanced search, fetched 2026-10-30T14:27:54.524Z)



## Answer

Mem0 stores extracted facts scoped to a user, an agent, a session, or an app, added as conversations arrive and retired by an expiry date or an explicit delete. Zep builds a temporal knowledge graph with validity intervals on facts. Letta, from the MemGPT lineage, gives the agent a git-backed filesystem of memory files it edits itself. Mem0 is best for personalized assistants and support agents, Zep for entity memory on a temporal knowledge graph, and Letta for agent-managed context in the MemGPT tradition.

## Results (8)

### 1. LangMem vs Mem0 vs Zep vs Letta vs Cognee: how to choose

- URL: <https://datapace.ai/blog/ai-agent-memory-tools-2026>
- Score: 0.8947989

> Short answer. The LangMem vs Mem0 choice is framework vs service: LangMem for memory primitives inside LangGraph, Mem0 for memory as a service behind any framework. Zep when facts need validity intervals. Letta when the agent curates its own context. Cognee for a graph built from your own code and table rows. None of the five resolves what your database means; that fifth category is a context layer, not a memory tool, and it composes with any of them. First check whether you need a memory tool at all, and check it on your own history length: on LOCOMO, at about 26,000 tokens per conversation, sending the whole thing beat every tool inside Mem0's own table, while on LongMemEval's much longer histories Zep's paper reports the reverse. What holds across both, and in our own public run on [...] ## Frequently asked questions

What is the difference between Mem0, Zep, and Letta?
:   They implement different memory types. Mem0 stores extracted facts scoped to a user, an agent, a session or an app, added as conversations arrive and retired by an expiry date or an explicit delete. Zep builds a temporal knowledge graph with validity intervals on facts. Letta, from the MemGPT lineage, gives the agent a git-backed filesystem of memory files it edits itself. [...] ## Mem0 vs Zep vs Letta vs LangMem vs Cognee, side by side

Here is the verdict the taxonomy produces: Mem0 for conversation and user memory as extracted facts, Zep for entity memory on a temporal knowledge graph, Cognee for entity memory built from your own sources and databases, Letta for agent-managed context in the MemGPT tradition, LangMem for memory primitives native to LangGraph. The table shows why.

Mem0

Memory type
:   conversation and user memory

Core abstraction
:   extracted facts scoped by user, agent, run and app

Time awareness
:   add-only ingestion; optional expiry date per memory

Who curates
:   the system, via extraction

Best for
:   personalized assistants and support agents

Deployment
:   Apache 2.0, self-hosted, or the hosted Mem0 Platform

Source: [LangMem vs Mem0 vs Zep vs Letta vs Cognee: how to choose](https://datapace.ai/blog/ai-agent-memory-tools-2026)

### 2. Best AI Agent Memory Platforms 2026: Mem0 vs Zep vs Letta | puppyone

- URL: <https://www.puppyone.ai/en/blog/best-ai-agent-memory-platforms>
- Score: 0.8886914

These products are not interchangeable. Mem0 and LangMem can be added as layers, Zep emphasizes graph-shaped memory, Letta makes memory part of the runtime, Cloudflare couples it to an application platform, and Redis gives you primitives rather than a finished memory product.

If you are choosing an architecture rather than a vendor, use Agent Memory Comparison in 2026: 6 Approaches. This page owns the platform-selection question; that guide compares embedding vaults, graph memory, stateful runtimes, and governed shared workspaces as architectural patterns.

## Key takeaways [...] Download
1.3K

# Best AI Agent Memory Platforms 2026: Mem0 vs Zep vs Letta

Updated First published Alex

Compare Mem0, Zep, Letta, LangMem, Cloudflare Agents, and Redis by use case, integration model, governance, and production fit—not just recall quality.

## Quick picks: which AI agent memory platform fits your use case?

Short answer: choose Mem0 when you want a memory API for an existing app, Zep/Graphiti when relationships and changing facts matter, Letta when memory is part of a long-running agent runtime, LangMem when your agents already use LangGraph, Cloudflare Agents when your application runs on Cloudflare, and Redis when your platform team wants to own the substrate. [...] | Letta | Long-running agents that should actively manage their own memory | Agent-controlled memory tiers and tools designed around persistent agents (Letta memory overview) | Adopting a stateful runtime and governing what the agent writes |
| LangMem | LangGraph applications that need persistent, namespaced memory tools | Tools for agents to create, update, delete, and search memories in a LangGraph store (LangMem memory tools) | A production store, extraction policy, retention, audit, and cross-runtime portability |

Source: [Best AI Agent Memory Platforms 2026: Mem0 vs Zep vs Letta | puppyone](https://www.puppyone.ai/en/blog/best-ai-agent-memory-platforms)

### 3. Agent Memory Tools Compared: Mem0, Zep, Letta, Cognee, MCP - InfraNodus

- URL: <https://infranodus.com/docs/llm-memory-tools-comparison>
- Score: 0.86413884

## LangMem

LangMem is a Python library for LangGraph builders. It extracts semantic memories (facts, in collections) and episodic memories from conversations and can optimise prompts from them. Memories are JSON documents in a LangGraph store namespace with an embedding index: in-memory for development, Postgres for production. There is no graph layer. The library is MIT and free; LangGraph Platform pricing is not published on the pages we fetched.

The last PyPI release is 0.0.30 from October 2025, so nothing has shipped in a year, and the repository has 1,722 stars. You can read the store with SQL, since it is rows of JSON. Choose LangMem only if you already run LangGraph and want memory in the same deployment. [...] A vector store keeps each memory as an embedding and returns the entries most similar to the current query. Mem0's core, Supermemory's search and LangMem's store work this way. It scales to millions of entries and answers "what did I say about X" well. It cannot answer "what changed since last month" unless the tool adds timestamps and invalidation on top, and the store itself is a list of vectors nobody can read.

A temporal graph stores facts as edges between entities, each with a validity window. When a fact changes, the old edge is marked invalid rather than deleted. Zep's Graphiti is the reference design; Cognee's graph layer is close. This answers "what changed" and "what was true in March" directly. Reading the store means running a graph database and knowing how to query it. [...] 1. Mem0: github.com/mem0ai/mem0, mem0.ai/pricing, docs.mem0.ai/open-source/features/graph-memory
2. Zep and Graphiti: github.com/getzep/graphiti, getzep.com/pricing, help.getzep.com/quickstart
3. Letta: github.com/letta-ai/letta-code, docs.letta.com/guides/agents/memory, docs.letta.com/letta-code/pricing
4. Cognee: github.com/topoteretes/cognee, cognee.ai/pricing, docs.cognee.ai
5. Supermemory: github.com/supermemoryai/supermemory, supermemory.ai/pricing, supermemory.ai/docs/concepts/graph-memory
6. LangMem: github.com/langchain-ai/langmem, langchain-ai.github.io/langmem
7. MCP memory server: github.com/modelcontextprotocol/servers/tree/main/src/memory
8. Native Claude memory: support.claude.com/en/articles/11817273

Source: [Agent Memory Tools Compared: Mem0, Zep, Letta, Cognee, MCP - InfraNodus](https://infranodus.com/docs/llm-memory-tools-comparison)

### 4. Agent memory: Letta vs Mem0 vs Zep vs Cognee - Community - Letta Developer Community

- URL: <https://forum.letta.com/t/agent-memory-letta-vs-mem0-vs-zep-vs-cognee/88>
- Score: 0.8548001

Although it is separate from the Letta Platform, the AI Memory SDK was built by the same team and uses Letta agents (subagents) running under the hood on Letta Cloud for memory management. It provides the benefits of Letta’s memory handling in a lightweight package that integrates with your existing LLM setup, without requiring the adoption of full stateful agent infrastructure.

### How the AI Memory SDK works

Like Mem0 or Zep, the AI Memory SDK enables you to initialize a memory instance, add conversations, and retrieve context when needed. The difference is that the AI Memory SDK runs background Letta agents (subconscious memory agents) that asynchronously process conversations between interactions rather than during them (during “sleeptime”). [...] Stateful agents have memory blocks that they can read and write to directly. These memory blocks are part of the agent’s core architecture, not external storage accessed through APIs. The agent can decide what to remember, what to forget, and how to organize its own memory.

The Letta Platform uses this approach. Agents exist as persistent entities with self-modifying memory, not as stateless functions called on demand.

For developers who want memory capabilities without adopting the full stateful paradigm, pluggable memory solutions like Letta’s AI Memory SDK provide a middle ground. These are lightweight libraries that add memory to existing applications without requiring an architectural shift.

## Mem0: Universal memory layer for LLM applications [...] Interoperability: Letta Platform is fully interoperable with other memory systems. Letta agents can use Mem0, Zep, Cognee, or any other tool through custom Python tools or by connecting to MCP (Model Context Protocol) servers. You can combine Letta’s stateful architecture with specialized memory systems for specific use cases.

## Further reading and resources

### Official documentation

### Source code

Excellent comprehensive comparison. A few additions that complement this analysis:

Sleeptime Agents in Letta

Source: [Agent memory: Letta vs Mem0 vs Zep vs Cognee - Community - Letta Developer Community](https://forum.letta.com/t/agent-memory-letta-vs-mem0-vs-zep-vs-cognee/88)

### 5. Mem0 - Products, Competitors, Financials, Employees, Headquarters Locations

- URL: <https://www.cbinsights.com/company/mem0>
- Score: 0.8335554

This comparison uses “frameworks” broadly: Cognee, Mem0, Hindsight, Zep, and LangMem include memory platforms, infrastructure, and developer libraries. The five were selected to illustrate different implementation approaches rather than produce a universal benchmark ranking. Hindsight is the overall recommendation for applications needing both persistent context and explicit reasoning over earlier work. LangMem is included because workflow-native learning is a meaningful alternative to adopting a separate service; Zep adds a temporal-context perspective. Five approaches to agent memory Cognee  Configurable knowledge and memory pipelines Quality of the representation built from source material Mem0  Application-facing memory operations Scoped recall inside an existing stack Hindsight [...] a retrospective needs the owner responsible when an earlier incident occurred. The test is whether retrieval returns the appropriate evidence for each question—not whether both names can be found somewhere in storage. Trade-off: Separate the managed Zep product from a custom Graphiti deployment in any comparison. Architecture, infrastructure responsibility, and available operational features are not interchangeable simply because the systems are related. 5. LangMem: For memory inside a custom agent workflow LangMem supplies tools for extracting information from conversations, maintaining long-term memory, and refining prompts from interaction data. Its documentation describes storage-independent primitives alongside native integration with LangGraph's storage layer.  This is worth [...] a synthesis step adds value. Trade-off: Different retrieval paths do not guarantee a correct answer. Test source coverage and the final interpretation separately, and include extraction and reasoning costs in the comparison rather than reporting query time alone. 4. Zep: For time-aware relationship retrieval Zep documents a temporal-context approach to agent memory built from user and business information. Its associated Graphiti documentation explains validity windows and source episodes as building blocks for representing changing relationships.  We would evaluate this approach with questions that deliberately distinguish current and historical truth. For example, a support case may need the current component owner, while a retrospective needs the owner responsible when an earlier

Source: [Mem0 - Products, Competitors, Financials, Employees, Headquarters Locations](https://www.cbinsights.com/company/mem0)

### 6. AI Agent Memory Frameworks in 2026: Memory vs. Context | Graphlit Blog

- URL: <https://www.graphlit.com/blog/survey-of-ai-agent-memory-frameworks>
- Score: 0.77137923

Agent memory in 2026 is not one category.

Mem0 is strong for managed long-term memory and personalization. Supermemory is strong for memory plus RAG over learned user context. Membase and Memory Store are strong for universal memory that follows users across AI tools. Hindsight, mem9, Kumiho, and Memora show how much experimentation is happening around learning, coding-agent memory, graph-native provenance, and lightweight persistent memory. Zep and Graphiti are strong for temporal graph memory. LangMem, CrewAI, and LlamaIndex are strong when memory belongs inside the framework loop. Cognee is strong for builders who want open-source graph memory infrastructure.

Graphlit is focused on a different layer: the operational context that agents need before memory becomes useful. [...] That distinction is the whole category.

This article is a 2026 survey of AI agent memory frameworks - Mem0, Supermemory, Membase, Memory Store, Zep, Graphiti, LangMem, Cognee, CrewAI, LlamaIndex, and Graphlit - but it is also an argument: memory and context are related, but they are not the same layer.

Graphlit is focused on the context layer.

We have been writing about this distinction in a few recent pieces: the operational context layer AI agents actually need, the event clock for temporal facts, and context graphs as organizational memory. This survey puts the current agent memory landscape around that thesis.

## The Short Version

There is no single "best" AI agent memory framework in 2026. The category has split into several different jobs: [...] I would not treat all of these as equivalent to Mem0, Zep, Supermemory, or Graphlit yet. Some are early, some are focused on coding agents, and some are research-heavy. But they show where the category is going: memory is becoming graph-shaped, source-aware, multi-agent, inspectable, and increasingly delivered through MCP or agent-native tools.

### Mem0: Managed Memory API

Mem0 is a dedicated memory engine for AI agents. It gives developers memory operations and hosted infrastructure around user, agent, and session memory, with graph memory and integrations in the broader platform.

Mem0 is attractive because it answers a very practical product question: how does my app remember what matters about this user or conversation without stuffing everything into the prompt?

Use Mem0 when:

Source: [AI Agent Memory Frameworks in 2026: Memory vs. Context | Graphlit Blog](https://www.graphlit.com/blog/survey-of-ai-agent-memory-frameworks)

### 7. Top Mem0 Alternatives, Competitors

- URL: <https://www.cbinsights.com/company/mem0/alternatives-competitors>
- Score: 0.7604555

Compare Mem0 and Kong
 Letta Logo

  Letta

  Letta specializes in artificial intelligence (AI) research and AI agent development. It develops AI agents with persistent memory and continuous learning capabilities f…

  Mem0 vs. Letta

  View more in-depth data on:

  + Competitors
  + Products
  + Customer References and more

  Compare Mem0 and Letta
 Zep AI Logo

  Zep AI

  Analyst Briefing Submitted

  Zep AI focuses on AI agent memory solutions in the artificial intelligence sector. The company provides a memory layer that allows AI agents to learn from user interact…

  Mem0 vs. Zep AI

  View more in-depth data on:

  + Competitors
  + Products
  + Customer References and more

  Compare Mem0 and Zep AI
 MemVerge Logo

  MemVerge [...] Compare Mem0 and Zep AI
 MemVerge Logo

  MemVerge

  MemVerge focuses on artificial intelligence (AI) memory technology, providing software solutions for AI agents. The company offers products that allow AI-powered applic…

  Mem0 vs. MemVerge

  View more in-depth data on:

  + Competitors
  + Products
  + Customer References and more

  Compare Mem0 and MemVerge

New call-to-action

### Top10Mem0competitors

 Cognee
 Memories.ai
 Hyperspell
 Supermemory
 Recall.ai
 Botpress
 Kong
 Letta
 Zep AI
 MemVerge

## Compare Mem0 to Competitors

Lyzr Logo

Lyzr

Source: [Top Mem0 Alternatives, Competitors](https://www.cbinsights.com/company/mem0/alternatives-competitors)

### 8. Zep vs Mem0: Which AI Memory Layer Should You Choose?

- URL: <https://mem0.ai/library/agent-memory/zep-vs-mem0-which-ai-memory-layer-should-you-choose>
- Score: 0.75355774

Two tools come up repeatedly in this space:   
Zep and Mem0.   
Both solve the stateless agent problem.   
Both handle long-term memory for LLM applications.   
  
But they come from different architectural philosophies, serve different developer profiles, and make different trade-offs around performance, hosting, and ease of integration.

This comparison breaks down how each actually works, where each fits best, and what you should look for depending on what you are building.

## What Mem0 Is

Mem0 is the memory layer for AI agents, designed to make context persist across conversations without stuffing raw chat history back into the prompt. [...] This is a real product with real engineering behind it. The comparison below is on published numbers, not vibes.

## Architecture

Zep's architecture is history-first. Raw conversation turns land in the store, entity extraction runs over them, and the result is a growing archive of structured-plus-unstructured memory. The temporal graph sits on top.

Mem0's architecture is distillation-first. Raw turns are not the unit of storage, extracted facts are. The pipeline is designed so that five turns of chit-chat produce zero new memories, and one turn with a load-bearing fact produces exactly one memory. The conflict detector keeps the store from bloating as the same user keeps talking. [...] | Metric | 1M Scale | 10M Scale |
 --- 
| Overall accuracy | 64.1 | 48.6 |
| Preference following | 88.3 | 90.4 |
| Instruction following | 85.2 | — |
| Knowledge update | — | 75.0 |
| Mean tokens | 6,719 | 6,914 |

The interesting signal: Mem0's token count barely grows from 1M to 10M. Most retrieval systems blow up their context budget to hold accuracy at scale. Mem0 holds flat around 7K.

### DMR — Deep Memory Retrieval

Zep reports on Deep Memory Retrieval with a clean win:

| System | DMR accuracy |
 --- |
| GPT-4-Turbo (full conversation) | 98.2% |
| Zep | 94.8% |
| MemGPT (Letta) | 93.4% |

Source: [Zep vs Mem0: Which AI Memory Layer Should You Choose?](https://mem0.ai/library/agent-memory/zep-vs-mem0-which-ai-memory-layer-should-you-choose)
