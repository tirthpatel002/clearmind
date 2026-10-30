---
question: "What benchmark results does NVIDIA report for Nemotron models?"
query: "NVIDIA Nemotron 3 benchmarks reported by NVIDIA"
fetchedAt: "2026-10-30T14:27:26.925Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://www.vals.ai/models/nvidia_nemotron-3-ultra-550b-a55b"
  - "https://benchlm.ai/models/nemotron-3-ultra"
  - "https://research.nvidia.com/labs/nemotron/Nemotron-3-Ultra"
  - "https://research.nvidia.com/labs/nemotron/Nemotron-3"
  - "https://developer.nvidia.com/blog/nvidia-nemotron-3-5-super-vl-powers-specialized-agents-with-multimodal-reasoning"
---
# What benchmark results does NVIDIA report for Nemotron models?


Query: `NVIDIA Nemotron 3 benchmarks reported by NVIDIA` (Tavily advanced search, fetched 2026-10-30T14:27:26.925Z)



## Answer

The sources report that the NVIDIA Nemotron 3 Ultra, released on June 4, 2026, ranks #5 among open-weight models on the Vals Index with a score of 43.99%. It ranks #3 on TaxEval v2, #4 on CorpFin v2, #5 on Finance Agent v2, and #6 on MedCode. It scores 86.11% on GPQA Diamond, 85.76% on MMLU Pro, and 82.07% on LegalBench. On coding benchmarks, it scores 86.0% on LiveCodeBench and 50.94% on Terminal Bench 2.1. The model achieves 5.9x, 4.8x, and 1.6x higher inference throughput compared to GLM-5.1-754B-A40B, Kimi-K2.6-1T-A32B, and Qwen-3.5-397B-17B respectively on the 8k token input / 64k token output setting.

## Results (5)

### 1. Nemotron 3 Ultra Benchmarks and Model Details | Vals AI

- URL: <https://www.vals.ai/models/nvidia_nemotron-3-ultra-550b-a55b>
- Score: 0.8533396

We evaluated NVIDIA’s new open-weight Nemotron 3 Ultra across our benchmark suite. It ranks #5 among open-weight models on the Vals Index, with a score of 43.99%.
 The model is strongest on domain-specific benchmarks. Among open-weight models, it ranks #3 on TaxEval v2 (73.10%), #4 on CorpFin v2 (65.46%), #5 on Finance Agent v2 (37.53%), and #6 on MedCode (38.62%).
 General reasoning is solid: Nemotron 3 Ultra scores 86.11% on GPQA Diamond, 85.76% on MMLU Pro, and 82.07% on LegalBench, landing between #5 and #7 among open-weight models on each.
 On coding, it scores 85.98% on LiveCodeBench, ranking #3 among open-weight models, and 50.94% on Terminal Bench 2.1, ranking #4 among open-weight models. [...] Meta

Wonder

🇺🇸

OCT 12, 2026

Nace.AI

Drex v2.0

🇺🇸

OCT 12, 2026

zAI

GLM Legal

🇨🇳

OCT 09, 2026

Cloudflare

Clef Omni

🇺🇸

OCT 09, 2026

Nace.AI

Drex v1.5

🇺🇸

OCT 09, 2026

Microsoft

Microsoft-Decision-1

🇺🇸

OCT 08, 2026

Upstage

Solar Decide Flash

🇰🇷

OCT 07, 2026

Anthropic

Claude Haiku 5.5

🇺🇸

OCT 07, 2026

Perplexity

Decider V1.1 27B

🇺🇸

OCT 06, 2026

Mistral

Mistral Large 4

🇫🇷

OCT 01, 2026

Cloudflare

Clef

🇺🇸

Compare Models

NVIDIA Vals

# Nemotron 3 Ultra

Nemotron 3 Ultra is an open-weight model from NVIDIA, released June 4, 2026.

Release Date: Jun 4, 2026

Developer   NVIDIA  🇺🇸

Context Window   1M

Max Output Tokens   128k

Token Costs (in/out)   N/A

Weights   Open [...] ±2.07

68/88

Terminal-Bench 2.1

50.94%

±2.92

57/75

Proprietary BenchmarksAcademic BenchmarksIndustry Partners

Vals

    View Hyperparameter Settings 

Default Provider :   NVIDIA 

Some benchmarks may use different provider and parameters. Please refer to the benchmark page for more information.

Temperature:   Default

Top P:   0.95

Top K:   Default

Max Output Tokens:   128,000

## Updates

Jun 4, 2026

    NVIDIA's Nemotron 3 Ultra evaluated across our benchmark suite

Source: [Nemotron 3 Ultra Benchmarks and Model Details | Vals AI](https://www.vals.ai/models/nvidia_nemotron-3-ultra-550b-a55b)

### 2. Nemotron 3 Ultra Benchmarks & Context (October 2026)

- URL: <https://benchlm.ai/models/nemotron-3-ultra>
- Score: 0.8390101

| Benchmark | Score | Versus best verified row | Gap | Weight | Evidence |
| SciCodeScientific Code Benchmark | Score44.6% | Versus best verified row   Best verified: Sakana Fugu · 60.1% | Gap15.5 behind | Weight10% ref. weight | Provider exact NVIDIA: Nemotron 3 Ultra Hugging Face model card |
| LiveCodeBench (Vals)LiveCodeBench, Vals AI run | Score86.0% | Versus best verified row   Best verified: Claude Fable 5.1 · 90.5% | Gap4.5 behind | Weight8% ref. weight | Verified Vals AI: LiveCodeBench leaderboard |
| SWE Multilingual | Score67.7% | Versus best verified row   Best verified: Claude Opus 5.5 · 93.9% | Gap26.2 behind | Weight5% ref. weight | Provider exact NVIDIA: Nemotron 3 Ultra Hugging Face model card | [...] | Benchmark | Score | Versus best verified row | Gap | Weight | Evidence |
| HLEHumanity's Last Exam | Score26.7% | Versus best verified row   Best verified: Kimi K3.1 Pro · 70% | Gap43.3 behind | Weight44% ref. weight | Provider exact NVIDIA: Nemotron 3 Ultra Hugging Face model card |
| HLE w/o toolsHumanity's Last Exam without tools | Score26.7% | Versus best verified row   Best verified: Claude Opus 5.5 · 64.4% | Gap37.7 behind | Weight7% ref. weight | Provider exact NVIDIA: Nemotron 3 Ultra Hugging Face model card |
| MMLU-ProMassive Multitask Language Understanding Professional | Score86.8% | Versus best verified row   Best verified: Qwen3.7 Max · 89.6% | Gap2.8 behind | Weight6% ref. weight | Provider exact NVIDIA: Nemotron 3 Ultra Hugging Face model card | [...] Nemotron 3 Ultra ranks #112 of 215 on the public leaderboard with a score of 47.39/100. It does not yet have enough sourced coverage for a verified position.

Nemotron 3 Ultrais a open weightmodelwith a 1M context window.It uses an explicit reasoning mode, which can improve complex problem solving while adding latency and token use.

Official exact-value snapshot from the nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16 Hugging Face model card. BenchLM maps directly comparable values from NVIDIA's table and keeps provider-specific rows display-only where appropriate. NVIDIA's earlier announcement used approximate 500B/50B wording; the released checkpoint is 550B total / 55B active.

25of 775 tracked benchmark slots currently have displayable evidence. Missing categories stay blank.

Source: [Nemotron 3 Ultra Benchmarks & Context (October 2026)](https://benchlm.ai/models/nemotron-3-ultra)

### 3. NVIDIA Nemotron 3 Ultra - NVIDIA Nemotron

- URL: <https://research.nvidia.com/labs/nemotron/Nemotron-3-Ultra>
- Score: 0.78552294

### Key Highlights

 Nemotron 3 Ultra achieves 5.9x, 4.8x, and 1.6x higher inference throughput compared to GLM-5.1-754B-A40B, Kimi-K2.6-1T-A32B, and Qwen-3.5-397B-17B respectively on the 8k token input / 64k token output setting.
 Nemotron 3 Ultra achieves on-par accuracies compared to other state-of-the-art open LLMs across a diverse set of benchmarks.
 Supports context length of up to 1M tokens while outperforming state-of-the-art open LLMs on RULER at 1M context length.

### Open Source

We are releasing the pre-trained, post-trained, and quantized checkpoints along with the datasets used for training.

#### Checkpoints: [...] NVIDIA

### NVIDIA

# NVIDIA Nemotron 3 Ultra

Published:

#### Models    Ultra Tech Report    Nemotron 3 Blog

We present our most capable model yet – Nemotron 3 Ultra with 550 billion total and 55 billion active parameters. Nemotron 3 Ultra is the final and best model of the Nemotron 3 family of models.

### Key Features

1. Employs Mixture-of-Experts Hybrid Mamba-Attention architecture.
2. Leverages LatentMoE for improved accuracy.
3. Includes MTP layers for faster inference through native speculative decoding.
4. Supports inference time reasoning budget control.
5. Pretrained in NVFP4.
6. Post-trained with enhanced pipeline involving Supervised Fine Tuning (SFT), Reinforcement Learning (RL), and Multi-teacher On-Policy Distillation (MOPD) for improved model accuracy. [...] #### Checkpoints:

 Nemotron 3 Ultra 550B-A55B NVFP4: post-trained and NVFP4 quantized model
 Nemotron 3 Ultra 550B-A55B BF16: post-trained model
 Nemotron 3 Ultra 550B-A55B Base BF16: base model
 Nemotron 3 Ultra 550B-A55B GenRM: GenRM used for RLHF

#### Data:

Source: [NVIDIA Nemotron 3 Ultra - NVIDIA Nemotron](https://research.nvidia.com/labs/nemotron/Nemotron-3-Ultra)

### 4. NVIDIA Nemotron 3 Family of Models - NVIDIA Nemotron

- URL: <https://research.nvidia.com/labs/nemotron/Nemotron-3>
- Score: 0.77548623

#### Key highlights:

 More accurate than GPT-OSS-20B and Qwen3-30B-A3B-Thinking-2507 on popular benchmarks spanning different categories.
 On the 8K input / 16K output setting with a single H200, Nemotron 3 Nano provides inference throughput that is 3.3x higher than Qwen3-30B-A3B and 2.2x higher than GPT-OSS-20B.
 Supports context length up to 1M tokens while outperforming both GPT-OSS-20B and Qwen3-30B-A3B-Instruct-2507 on RULER across different context lengths.
 We are releasing the model weights, training recipe, and all the data for which we hold redistribution rights.

## Open Source

Along with the Nemotron 3 white paper and the Nano 3 technical report, we are releasing the following:

#### Checkpoints: [...] NVIDIA

### NVIDIA

# NVIDIA Nemotron 3 Family of Models

Published:

#### Models    Nemotron 3 White Paper    Nano Tech Report    Super Tech Report    Ultra Tech Report    Try It!

Update: Nemotron 3 Ultra is now released! Ultra Blog

We announce NVIDIA Nemotron 3, the most efficient family of open models with leading accuracy for agentic AI applications. The Nemotron 3 family consists of three models: Nano, Super, and Ultra. These models deliver strong agentic, reasoning, and conversational capabilities. [...] Nano, the smallest model, outperforms comparable models in accuracy while remaining extremely cost-efficient for inference. Super is optimized for collaborative agents and high-volume workloads such as IT ticket automation. Ultra, the largest model, provides state-of-the-art accuracy and reasoning performance.

We are releasing the Nemotron 3 Nano model and technical report. Super and Ultra releases will follow in the coming months.

## Nemotron 3 technologies

Source: [NVIDIA Nemotron 3 Family of Models - NVIDIA Nemotron](https://research.nvidia.com/labs/nemotron/Nemotron-3)

### 5. NVIDIA Nemotron 3.5 Super VL Powers Specialized Agents with Multimodal Reasoning | NVIDIA Technical Blog

- URL: <https://developer.nvidia.com/blog/nvidia-nemotron-3-5-super-vl-powers-specialized-agents-with-multimodal-reasoning>
- Score: 0.72907686

For document intelligence, the same model can interpret a chart, connect it with a table elsewhere in a document, and summarize both. Developers can tailor the workflow to their own documents and evaluation criteria.

Diverse training data generated with NeMo Data Designer helped the model better understand complex charts. On CharXiv, a chart-reasoning benchmark, the model scored 80.8%, compared with 63% for Nemotron 3 Nano Omni. With Python code interpretation, it reached 84%. For the approach and lessons learned, read the chart-understanding deep dive and the open-source chart question-answering pipeline. [...] | Model | Hermes Bench | LangChain Evals |
 --- 
| Nemotron 3 Ultra | 56.33% | 84.3% |
| Nemotron 3.5 Super VL | 63.44% | 87.05% |

Table 1. Nemotron 3.5 Super VL scores higher than Nemotron 3 Ultra on Hermes Bench and LangChain evaluations

For always-on agents, efficiency determines how much work a deployment can complete. Throughput, token usage, tool calls, and the steps needed to reach a correct result all affect task completion time.

The chart shows coding accuracy versus time to task completion of 10,000 tasks on NVIDIA B200 GPUs. It compares the amount of time it takes for different open models in its class to complete the task. Nemotron 3.5 Super VL completes the tasks fastest. [...] The chart compares the accuracy of customized Nemotron 3.5 Super VL against out-of-the-box accuracy and other benchmark models as measured by various organizations inside their agentic workflows.

Figure 2. Post-trained Nemotron 3.5 Super VL achieves leading performance for specialized tasks across industries

Teams can use NVIDIA NeMo open libraries to post-train models to meet these requirements. Developers can use NVIDIA NeMo AutoModel for supervised fine-tuning (SFT) and low-rank adaptation (LoRA) to teach domain-specific behavior. Reinforcement learning (RL) improves performance in agentic environments that reflect organizational workflows.

Source: [NVIDIA Nemotron 3.5 Super VL Powers Specialized Agents with Multimodal Reasoning | NVIDIA Technical Blog](https://developer.nvidia.com/blog/nvidia-nemotron-3-5-super-vl-powers-specialized-agents-with-multimodal-reasoning)
