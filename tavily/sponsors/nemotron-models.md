---
question: "What are the NVIDIA Nemotron models (model cards, sizes, active parameters, context)?"
query: "NVIDIA Nemotron 3 Nano Super Ultra model card parameters context length"
fetchedAt: "2026-10-30T14:27:23.317Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html"
  - "https://developer.nvidia.com/blog/inside-nvidia-nemotron-3-techniques-tools-and-data-that-make-it-efficient-and-accurate"
  - "https://finance.yahoo.com/news/truist-raises-nvidia-nvda-pt-150936819.html"
  - "https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Ultra-Technical-Report.pdf"
  - "https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html"
  - "https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html?fr=sycsrp_catchall"
---
# What are the NVIDIA Nemotron models (model cards, sizes, active parameters, context)?


Query: `NVIDIA Nemotron 3 Nano Super Ultra model card parameters context length` (Tavily advanced search, fetched 2026-10-30T14:27:23.317Z)



## Answer

The sources indicate that the context length for the Nemotron 3 Nano model is 1 million tokens. This model, available today, is part of the Nemotron 3 family which includes Nano, Super, and Ultra variants. The Nano model, with 30 billion parameters, activates up to 3 billion parameters at a time and features a 1M-token context window, enabling sustained reasoning across large codebases, long documents, and extended conversations. The Super and Ultra variants, expected in the first half of 2026, will add further capabilities and efficiency improvements.

## Results (6)

### 1. NVIDIA debuts Nemotron 3 open-model family for AI agents | NVDA Stock News

- URL: <https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html>
- Score: 0.8830044

The lineup includes Nemotron 3 Nano (30B), Nemotron 3 Super (~100B) and Nemotron 3 Ultra (~500B). Nemotron 3 Nano is available today and claims 4x token throughput vs Nemotron 2 Nano, a 1M-token context window and up to 60% reduction in reasoning-token generation. NVIDIA released 3 trillion tokens of training/post-training/RL data plus NeMo Gym, NeMo RL and NeMo Evaluator; Super/Ultra expected H1 2026.

Loading...

Loading translation...

### Positive

 Nemotron 3 Nano available today for inference providers
 Model size tiers: 30B, ~100B, ~500B parameters
 4x token throughput vs Nemotron 2 Nano
 1,000,000-token context window for long-horizon tasks
 3 trillion tokens of released pretraining and RL datasets

### Negative [...] Nemotron 3 Super size
:   100 billion parameters
:   High-accuracy reasoning model with up to 10 billion active per token

Nemotron 3 Ultra size
:   500 billion parameters
:   Large reasoning engine with up to 50 billion active per token

Nano throughput gain
:   4x higher throughput
:   Nemotron 3 Nano vs Nemotron 2 Nano token throughput

Reasoning token reduction
:   60% reduction
:   Reduction in reasoning-token generation for Nemotron 3 Nano

Context window
:   1 million tokens
:   Nemotron 3 Nano context window size

Nemotron datasets size
:   3 trillion tokens
:   Pretraining, post‑training and RL datasets for Nemotron agents

Active parameters Nano
:   3 billion parameters
:   Maximum active parameters at a time for Nemotron 3 Nano

### Historical Context [...] Nemotron 3 Nano, a small, 30-billion-parameter model that activates up to 3 billion parameters at a time for targeted, highly efficient tasks.
 Nemotron 3 Super, a high-accuracy reasoning model with approximately 100 billion parameters and up to 10 billion active per token, for multi-agent applications.
 Nemotron 3 Ultra, a large reasoning engine with about 500 billion parameters and up to 50 billion active per token, for complex AI applications.

Available today, Nemotron 3 Nano is the most compute-cost-efficient model, optimized for tasks such as software debugging, content summarization, AI assistant workflows and information retrieval at low inference costs. The model uses a unique hybrid MoE architecture to deliver gains in efficiency and scalability.

Source: [NVIDIA debuts Nemotron 3 open-model family for AI agents | NVDA Stock News](https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html)

### 2. Inside NVIDIA Nemotron 3: Techniques, Tools, and Data That Make It Efficient and Accurate | NVIDIA Technical Blog

- URL: <https://developer.nvidia.com/blog/inside-nvidia-nemotron-3-techniques-tools-and-data-that-make-it-efficient-and-accurate>
- Score: 0.8619225

A native 1M-token context window enables sustained reasoning across large codebases, long documents, and extended agent sessions without fragmented chunking.
 Nemotron 3 Nano, a 30B total and 3B active parameter model, is available now for DGX Spark, H100, and B200 GPUs, achieving leading scores on the Artificial Analysis Intelligence Index while preserving openness.
 Super and Ultra variants, coming in the first half of 2026, will add latent MoE for 4x more experts at the same inference cost, multi-token prediction for higher throughput, and NVFP4 training for cost-accuracy optimization. [...] A hybrid Mamba-Transformer MoE backbone for superior test-time efficiency and long-range reasoning.
 Multi-environment reinforcement learning designed around real-world agentic tasks.
 A 1M-token context length supporting deep multi-document reasoning and long-running agent memory.
 An open, transparent training pipeline, including data, weights, and recipes.
 Immediate availability of Nemotron 3 Nano with ready-to-use cookbooks. Super and Ultra to follow.

## Simple prompt example

 

Video 1. A video of a table seating logical puzzle running on Nemotron 3 Nano.

 

## Key technologies for Nemotron 3 models

### Hybrid Mamba-Transformer MoE

Nemotron 3 integrates three architectures into a single backbone: [...] ### 1M token context length

Nemotron 3’s 1M-token context enables sustained reasoning across large codebases, long documents, extended conversations, and aggregated retrieved content. Instead of relying on fragmented chunking heuristics, agents can keep entire evidence sets, history buffers, and multi-stage plans in a single context window.

This long context window is enabled by Nemotron 3’s hybrid Mamba-Transformer architecture, which processes extremely large sequences efficiently. MoE routing also keeps the per-token compute lower, making these large sequences practical at time of inference.

Source: [Inside NVIDIA Nemotron 3: Techniques, Tools, and Data That Make It Efficient and Accurate | NVIDIA Technical Blog](https://developer.nvidia.com/blog/inside-nvidia-nemotron-3-techniques-tools-and-data-that-make-it-efficient-and-accurate)

### 3. Truist Raises NVIDIA (NVDA) PT After Nemotron 3 AI Model Launch

- URL: <https://finance.yahoo.com/news/truist-raises-nvidia-nvda-pt-150936819.html>
- Score: 0.8524574

In a different update, on December 15, NVIDIA launched its Nemotron 3 family of open models. The family includes three models in different sizes: Nano (30 billion parameters, with about 3 billion active), Super (around 100 billion parameters), and Ultra (around 500 billion parameters). These allow developers to select a model that fits their needs, stated the company.

According to NVIDIA, the key innovation with this model family is the hybrid mixture-of-experts architecture. The architecture combines Mamba and Transformer technologies, which boosts efficiency. For example, Nemotron 3 Nano delivers 4x higher throughput compared to the previous Nemotron 2 Nano. As such, the updated model produces more tokens per second in multi-agent setups.

Source: [Truist Raises NVIDIA (NVDA) PT After Nemotron 3 AI Model Launch](https://finance.yahoo.com/news/truist-raises-nvidia-nvda-pt-150936819.html)

### 4. NVIDIA-Nemotron-3-Ultra-Technical-Report.pdf

- URL: <https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Ultra-Technical-Report.pdf>
- Score: 0.8467682

Similar to Nemotron 3 Super & Nano, we added a long-context phase (LC-Phase) at the end of pretraining. In the LC-Phase, we performed continuous pretraining (CPT) to equip the base model with long-context ability. We used a constant learning rate of 2 .5  10 −6. We used 32-way context parallelism, 8-way tensor parallelism, 128-way expert parallelism, and 2-way pipeline parallelism to train on GB200 GPUs. Besides the long-context document QA data we used in Nemotron 3 Super & Nano, we further added long-context SFT-style data into the blend. We did not use any RULER-style data in the blend. Overall, the long-context data was 46% and Phase 2 data was 54% in the blend. We performed CPT on 1,048,576 (1M) context length for 92% of the iterations, while we trained on 4,096 (4K) for the [...] We introduce Nemotron 3 Ultra, a 550 billion total and 55 billion active parameter Mixture-of-Experts Hybrid Mamba-Attention language model. We pre-trained Nemotron 3 Ultra on 20 trillion text tokens, then extended the context length to 1M tokens, and post-trained using Supervised Fine Tuning (SFT), Reinforcement Learning (RL), and Multi-teacher On-Policy Distillation (MOPD). Nemotron 3 Ultra is our most capable model yet, employing multiple key technologies - LatentMoE, Multi Token Prediction (MTP), NVFP4 pre-training, multi-environment RLVR, MOPD, and reasoning budget control. Nemotron 3 Ultra achieves up to ∼ 6× higher inference throughput as compared to state-of-the-art publicly available LLMs while attaining on-par accuracy. The state-of-the-art accuracy, high inference throughput, [...] The state-of-the-art accuracy, high inference throughput, and 1M token context length make Nemotron 3 Ultra ideal for long-running autonomous agentic tasks. We open-source the base, post-trained, and quantized checkpoints, along with the training data and recipe on HuggingFace.

Source: [NVIDIA-Nemotron-3-Ultra-Technical-Report.pdf](https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Ultra-Technical-Report.pdf)

### 5. NVIDIA Debuts Nemotron 3 Family of Open Models

- URL: <https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html>
- Score: 0.83678174

Nemotron 3 Nano, a small, 30-billion-parameter model that activates up to 3 billion parameters at a time for targeted, highly efficient tasks.
 Nemotron 3 Super, a high-accuracy reasoning model with approximately 100 billion parameters and up to 10 billion active per token, for multi-agent applications.
 Nemotron 3 Ultra, a large reasoning engine with about 500 billion parameters and up to 50 billion active per token, for complex AI applications.

Available today, Nemotron 3 Nano is the most compute-cost-efficient model, optimized for tasks such as software debugging, content summarization, AI assistant workflows and information retrieval at low inference costs. The model uses a unique hybrid MoE architecture to deliver gains in efficiency and scalability. [...] This design achieves up to 4x higher token throughput compared with Nemotron 2 Nano and reduces reasoning-token generation by up to 60%, significantly lowering inference costs. With a 1-million-token context window, Nemotron 3 Nano remembers more, making it more accurate and better capable of connecting information over long, multistep tasks.

Artificial Analysis, an independent organization that benchmarks AI, ranked the model as the most open and efficient among models of the same size, with leading accuracy.

Nemotron 3 Super excels at applications that require many collaborating agents to achieve complex tasks with low latency. Nemotron 3 Ultra serves as an advanced reasoning engine for AI workflows that demand deep research and strategic planning. [...] News Summary:

 The Nemotron 3 family of open models — in Nano, Super and Ultra sizes — introduces the most efficient family of open models with leading accuracy for building agentic AI applications.
 Nemotron 3 Nano delivers 4x higher throughput than Nemotron 2 Nano and delivers the most tokens per second for multi-agent systems at scale through a breakthrough hybrid mixture-of-experts architecture.
 Nemotron achieves superior accuracy from advanced reinforcement learning techniques with concurrent multi-environment post-training at scale.
 NVIDIA is the first to release a collection of state-of-the-art open models, training datasets and reinforcement learning environments and libraries for building highly accurate, efficient, specialized AI agents.

Source: [NVIDIA Debuts Nemotron 3 Family of Open Models](https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html)

### 6. NVIDIA Debuts Nemotron 3 Family of Open Models

- URL: <https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html?fr=sycsrp_catchall>
- Score: 0.83678174

Nemotron 3 Nano, a small, 30-billion-parameter model that activates up to 3 billion parameters at a time for targeted, highly efficient tasks.
 Nemotron 3 Super, a high-accuracy reasoning model with approximately 100 billion parameters and up to 10 billion active per token, for multi-agent applications.
 Nemotron 3 Ultra, a large reasoning engine with about 500 billion parameters and up to 50 billion active per token, for complex AI applications.

Available today, Nemotron 3 Nano is the most compute-cost-efficient model, optimized for tasks such as software debugging, content summarization, AI assistant workflows and information retrieval at low inference costs. The model uses a unique hybrid MoE architecture to deliver gains in efficiency and scalability. [...] This design achieves up to 4x higher token throughput compared with Nemotron 2 Nano and reduces reasoning-token generation by up to 60%, significantly lowering inference costs. With a 1-million-token context window, Nemotron 3 Nano remembers more, making it more accurate and better capable of connecting information over long, multistep tasks.

Artificial Analysis, an independent organization that benchmarks AI, ranked the model as the most open and efficient among models of the same size, with leading accuracy.

Nemotron 3 Super excels at applications that require many collaborating agents to achieve complex tasks with low latency. Nemotron 3 Ultra serves as an advanced reasoning engine for AI workflows that demand deep research and strategic planning. [...] News Summary:

 The Nemotron 3 family of open models — in Nano, Super and Ultra sizes — introduces the most efficient family of open models with leading accuracy for building agentic AI applications.
 Nemotron 3 Nano delivers 4x higher throughput than Nemotron 2 Nano and delivers the most tokens per second for multi-agent systems at scale through a breakthrough hybrid mixture-of-experts architecture.
 Nemotron achieves superior accuracy from advanced reinforcement learning techniques with concurrent multi-environment post-training at scale.
 NVIDIA is the first to release a collection of state-of-the-art open models, training datasets and reinforcement learning environments and libraries for building highly accurate, efficient, specialized AI agents.

Source: [NVIDIA Debuts Nemotron 3 Family of Open Models](https://finance.yahoo.com/news/nvidia-debuts-nemotron-3-family-140000058.html?fr=sycsrp_catchall)
