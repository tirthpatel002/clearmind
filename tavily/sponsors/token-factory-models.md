---
question: "Which models does Nebius Token Factory serve (including Nemotron variants and Qwen3-Embedding-8B)?"
query: "Nebius Token Factory models list Nemotron Qwen3-Embedding-8B"
fetchedAt: "2026-10-30T14:26:51.692Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://www.tdsynnex.com/na/us/nebius/open-source-ai-models"
  - "https://github.com/TheGreatBonnie/draftly-agent-backend/blob/master/docs/hackathon/nebius-token-factory-probes.md"
  - "https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680"
  - "https://finance.yahoo.com/news/nebius-launches-token-factory-boost-161449452.html"
  - "https://nebius.com/newsroom/nebius-agrees-to-acquire-eigen-ai-strengthening-nebius-token-factory-as-a-frontier-inference-platform"
  - "https://build.nvidia.com/nvidia/nemotron-3_5-embed-8b/modelcard"
  - "https://docs.tokenfactory.nebius.com/ai-models-inference/overview"
  - "https://www.investing.com/news/stock-market-news/alibaba-launches-qwen3embedding-and-qwen3reranker-series-for-multilingual-text-embedding-93CH-4085139"
---
# Which models does Nebius Token Factory serve (including Nemotron variants and Qwen3-Embedding-8B)?


Query: `Nebius Token Factory models list Nemotron Qwen3-Embedding-8B` (Tavily advanced search, fetched 2026-10-30T14:26:51.692Z)



## Answer

The sources confirm that the Nebius Token Factory includes the model Qwen/Qwen3-Embedding-8B. This model is listed under the "Embeddings and guardrails" section on the Nebius Token Factory platform and is also verified as the default embedding model in the registry settings for the `embedding-nebius-token-factory` in the GitHub documentation. Additionally, the model's embedding dimensions are confirmed to be exactly 1536.

## Results (8)

### 1. Nebius Token Factory | Open-Source AI Models Platform

- URL: <https://www.tdsynnex.com/na/us/nebius/open-source-ai-models>
- Score: 0.78866494

### Text and multimodal

 DeepSeek R1 and V3
 DeepSeek-R1-Distill-Llama-70B
 Llama-3.3-70B-Instruct
 Mistral-Nemo-Instruct-2407
 Qwen2.5-72B
 QwQ-32B
 Google Gemma-2-27B-IT
 GPT OSS 120B and 20B

View all models

### Embeddings and guardrails

 BAAI/bge-en-icl
 BAAI/bge-multilingual-gemma2
 intfloat/e5-mistral-7b-instruct
 meta-Llama/Llama-Guard-3-8B
 Qwen/Qwen3-Embedding-8B

View all models

## Run AI in production. Control every variable that matters.

### Scalable inference

Handle hundreds of millions of tokens per minute with autoscaling throughput and 99.9% uptime SLAs. Scale seamlessly from prototype to global deployment without rate throttles or GPU wrangling.

### Low latency [...] ### Multi-modal flexibility

Access 60+ open-source AI models spanning LLMs, vision, reasoning and embeddings through one OpenAI-compatible API. Add fine-tuned or custom models on the same governed platform.

### Developer-friendly integration

Rely on a familiar OpenAI-compatible API, structured JSON outputs, native function calling and built-in safety guardrails. Integrate once and deploy anywhere, with no infrastructure management required.

## Benchmark-backed performance and cost efficiency

### Proven performance, verified benchmarks

Get sub-second responses and stable with consistent throughput and latency, even at peak load. Top-tier performance on models like DeepSeek V3 0324, independently verified by Artificial Analysis.

### Scale without limits [...] ### Scale without limits

Handle 100M+ tokens per minute with consistent throughput and 99.9% uptime SLAs. Autoscaling and speculative decoding ensure reliability from prototype to global deployment.

### Comprehensive model coverage

Access 60+ open-source AI models spanning LLMs, vision, reasoning and embeddings, expanding monthly.

## A community of AI innovators

A pioneering open-source LLM inference framework partnered with Nebius to supercharge DeepSeek R1 performance for real-world production use.

Read the story

4X

faster first token

80

concurrent request handled

2x

boost in throughput

The leading open-source vLLM used Nebius compute clusters to test, benchmark and optimize inference across large-scale model architectures, including DeepSeek R1.

Read the story

0

Source: [Nebius Token Factory | Open-Source AI Models Platform](https://www.tdsynnex.com/na/us/nebius/open-source-ai-models)

### 2. draftly-agent-backend/docs/hackathon/nebius-token-factory-probes.md at master · TheGreatBonnie/draftly-agent-backend · GitHub

- URL: <https://github.com/TheGreatBonnie/draftly-agent-backend/blob/master/docs/hackathon/nebius-token-factory-probes.md>
- Score: 0.77913743

## Registry defaults verified

| registry name | env var | default |
 --- 
| `nemotron-nano-fast` | `NEMOTRON_NANO_MODEL_ID` | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` |
| `nemotron-super-research` | `NEMOTRON_SUPER_MODEL_ID` | `nvidia/nemotron-3-super-120b-a12b` |
| `nemotron-ultra-doc` | `NEMOTRON_ULTRA_MODEL_ID` | `nvidia/Nemotron-3-Ultra-550b-a55b` |
| `embedding-nebius-token-factory` | `EMBEDDING_MODEL_ID` | `Qwen/Qwen3-Embedding-8B` |

## Cost model

Input/output prices are the registered Token Factory rates per 1M tokens:

| model | context | input $/1M | output $/1M |
 ---  --- |
| `nemotron-nano-fast` | 262,000 | 0.06 | 0.24 |
| `nemotron-super-research` | 256,000 | 0.30 | 0.90 |
| `nemotron-ultra-doc` | 1,024,000 | 1.00 | 3.00 | [...] 3. `reasoningContent is not supported in multi-turn` is logged by the endpoint on follow-up turns; it is advisory and did not fail any probe.
4. Embedding dims confirmed. `Qwen/Qwen3-Embedding-8B` returns exactly 1536 dims, matching the `VECTOR(1536)` schema. [...] Download raw file

Outline

Edit and raw actions

# Nebius Token Factory live probe — Nemotron-3 + Qwen3-Embedding

Date: 2026-09-19 Account endpoint: ` Script: `tests/scripts/probe_token_factory.py` Raw results: `/tmp/tf-sweep-final.json` (regenerated by the command below)

This is the probe-first gate for the Nemotron-on-Token-Factory workstream (see `docs/superpowers/plans/2026-09-19-nemotron-token-factory.md` in the parent repo). Every registered Token Factory model is exercised against its real provider before any role mapping is locked in.

## How to reproduce

```
cd# .env needs NEBIUS_TOKEN_FACTORY_API_KEY (and optional _BASE_URL) ## faster, skips the ~260K/~1M-token context smoke probes: #
```

Source: [draftly-agent-backend/docs/hackathon/nebius-token-factory-probes.md at master · TheGreatBonnie/draftly-agent-backend · GitHub](https://github.com/TheGreatBonnie/draftly-agent-backend/blob/master/docs/hackathon/nebius-token-factory-probes.md)

### 3. Nebius launches token factory platform for open-source AI models

- URL: <https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680>
- Score: 0.74273956

In this article:

NBIS-0.27%

AMSTERDAM - Nebius (NASDAQ:NBIS) unveiled Nebius Token Factory, a production inference platform that enables companies to deploy and optimize open-source and custom AI models at scale with enterprise-grade security. The announcement comes as the company's stock has experienced a recent pullback, down 11.6% over the past week despite posting an impressive 481.8% return over the last year, according to InvestingPro data.

Built on Nebius's AI infrastructure, the platform integrates high-performance inference, post-training capabilities, and access management into a single governed system. Token Factory supports major open models including NVIDIA Nemotron, DeepSeek, GPT-OSS by OpenAI, Llama, and Qwen, while also allowing customers to host their own models. [...] Dow Jones
           Gold
           Silver
           S&P 500
           Copper

       Funds

           World Funds
           Major Funds

           Dynamic Power American Growth
           Fidelity Global Innovators Class F
           RBC Select Growth Portfolio Series F
           RBC Select Balanced Portfolio Series A

       Bonds

           Financial Futures
           World Government Bonds
           Government Bond Spreads
           Forward Rates
           Bond Indices
           Credit Default Swap Rates (CDS)

           Canada 3Y
           Canada 5Y
           Canada 10Y
           Canada 30Y
           U.S. 2Y
           U.S. 5Y
           U.S. 10Y
           U.S. 30Y

       Cryptocurrency [...] Shopify
           Air Canada
           Hut 8
           Enbridge
           Tesla
           NVIDIA
           AMD
           Apple
           SpaceX

       ETFs

           Major ETFs
           World ETFs
           Canada ETFs
           USA ETFs
           Marijuana ETFs
           Bitcoin ETFs

           SPDR S&P 500
           BetaPro Crude Oil 2x Daily Bull
           BetaPro Natural Gas 2x Daily Bull
           Invesco QQQ Trust
           Direxion Daily S&P 500 Bull 3X Shares
           ProShares UltraPro QQQ
           iShares Core Equity ETF Portfolio
           Vanguard All-Equity Portfolio

       Futures

           Indices Futures
           Commodities Prices
           FX Futures
           Financial Futures
           Perpetual Futures

Source: [Nebius launches token factory platform for open-source AI models](https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680)

### 4. Nebius Launches Token Factory to Boost Open AI Models

- URL: <https://finance.yahoo.com/news/nebius-launches-token-factory-boost-161449452.html>
- Score: 0.7018975

The Netherlands-based cloud firm describes Token Factory as a kind of all-in-one toolkit for developers. It combines inference, post-training, and access management into a single platform, making it easier to take AI models from testing to full production. It supports major open models like Nvidia's Nemotron, OpenAI's (OPENAI) GPT-OSS, Meta's (NASDAQ:META) Llama, DeepSeek, and Alibaba's (NYSE:BABA) Qwen and promises to cut inference costs and latency by up to 70%.

We didn't just want to build another model-serving platform, said co-founder Roman Chernin. We wanted to help teams actually scale faster, smarter, and more cost-effectively. [...] 1. My Portfolio
2. 1. Stocks 
      1. Most Active
      2. Day Gainers
      3. Day Losers
      4. Trending
      5. Highest Dividend
      6. Large Cap
      7. Small Cap
      8. Most Expensive
      9. Highest Beta
      10. Pink Sheet
      11. Unusual Volume
   2. Crypto 
      1. Most Active
      2. Day Gainers
      3. Day Losers
   3. Private Companies 
      1. 52 Week Gainers
      2. Recently Funded
      3. Most Funded
   4. Options 
      1. Day Gainers
      2. Day Losers
      3. Highest Open Interest
      4. Highest Implied Volatility
   5. Sectors 
      1. Technology
      2. Financial Services
      3. Consumer Cyclical
      4. Consumer Defensive
      5. Communication Services
      6. Healthcare
      7. Industrials
   6. Treasury Bonds
   7. Currencies [...] 4. Student Loan Forgiveness
      5. Paying Off Student Loans
   6. Personal Loans 
      1. Best Personal Loans
      2. Get Approved
      3. Best Lenders
   7. Insurance 
      1. Find Car Insurance
      2. Types of Car Insurance
      3. Car Insurance Discounts
      4. Find Life Insurance
   8. Taxes 
      1. How to File
      2. Refund Status
      3. Tax Extension
      4. Child Tax Credit
   9. Investing 
      1. Investing Basics
      2. Real Estate Investing
      3. Retirement Basics
   10. Calculators
6. 1. Daily Shows
   2. The 8:30
   3. Sozzi Unleashed
   4. The Daily Wolf
   5. Market Hang
   6. In the Loop
   7. Weekly Shows
   8. Built Different
   9. How They Run
   10. Power Players
   11. The Big Idea
   12. Trader Talk
   13. ETF Report
   14. FA Corner

Source: [Nebius Launches Token Factory to Boost Open AI Models](https://finance.yahoo.com/news/nebius-launches-token-factory-boost-161449452.html)

### 5. Nebius agrees to acquire Eigen AI, strengthening Nebius Token Factory as a frontier inference platform

- URL: <https://nebius.com/newsroom/nebius-agrees-to-acquire-eigen-ai-strengthening-nebius-token-factory-as-a-frontier-inference-platform>
- Score: 0.6519982

Eigen AI addresses this challenge with a full-stack optimization approach that spans the entire model lifecycle. From post-training and fine-tuning to production inference optimization, across all major open-source models in production demand, including GPT-OSS, Gemma, Qwen, Llama, Nemotron, DeepSeek, GLM, Kimi and MiniMax.

By integrating Eigen AI’s optimization layer directly into Nebius Token Factory, Nebius removes this bottleneck across the lifecycle. The system-, model-, and kernel-level techniques developed by the Eigen team are designed to extract materially better performance from hardware out of the box, delivering higher throughput and lower cost per inference without additional engineering overhead. [...] Running inference efficiently in production is inherently complex and requires deep expertise across the entire execution stack, from how models are represented, to how GPU kernels execute them, to how workloads are scheduled in real time.

Open-source models typically ship unoptimized, and newer architectures such as Mixture-of-Experts (MoE), Compressed Sparse Attention (CSA), reasoning, and long-context models introduce additional challenges around memory, routing, and compute efficiency. Most teams do not have the capacity to solve these problems in-house. [...] The acquisition will strengthen Nebius Token Factory as a frontier managed inference platform for production AI, combining a battle-tested optimization stack with Nebius’s global compute capacity and AI cloud platform, and will add elite inference research talent to the company’s established in-house AI R&D capabilities.

Following close, Eigen AI’s inference and post-training optimization layers will be integrated directly into Nebius Token Factory, which provides enterprise-grade autoscaling endpoints and fine-tuning pipelines across all major open-source models. The two companies have already delivered jointly optimized implementations of leading open source models that ranked among the fastest on Artificial Analysis.

Source: [Nebius agrees to acquire Eigen AI, strengthening Nebius Token Factory as a frontier inference platform](https://nebius.com/newsroom/nebius-agrees-to-acquire-eigen-ai-strengthening-nebius-token-factory-as-a-frontier-inference-platform)

### 6. nemotron-3.5-embed-8b Model by NVIDIA | NVIDIA NIM

- URL: <https://build.nvidia.com/nvidia/nemotron-3_5-embed-8b/modelcard>
- Score: 0.60750073

The 8B BF16 model achieves NDCG@10 scores of 60.39 (image), 60.65 (text), and 61.47 (image + text) on ViDoRe V3, and 70.15 (image) on MIRACL-VISION.

 Detailed Benchmark Comparison Table

| Model | ViDoRe V3 | MIRACL-VISION |
 --- 
| image | text | image + text | image |
| Qwen3-VL-Embedding-2B | 52.89 | 48.31 | 51.97 | 56.19 |
| Nemotron-3.5-Embed-1B-BF16 | 58.02 | 57.80 | 58.82 | 66.56 |
| Qwen3-VL-Embedding-8B | 58.29 | 53.69 | 57.03 | 65.87 |
| Nemotron-3.5-Embed-8B-BF16 | 60.39 | 60.65 | 61.47 | 70.15 | [...] Nemotron-3.5-Embed-8B-BF16 is a world-class, versatile embedding model trained by NVIDIA and optimized for multimodal and multilingual question-answering retrieval. The model can embed document pages in the form of image, text, or combined image–text inputs. Documents can be retrieved given a user query in text form. The model supports page images containing text, tables, charts, and infographics. For text retrieval, the model was evaluated across 34 languages: English, Arabic, Assamese, Bengali, Bulgarian, Chinese, Danish, Dutch, Finnish, French, German, Hindi, Hinglish, Indonesian, Italian, Japanese, Korean, Malay, Marathi, Nepali, Norwegian, Persian, Portuguese, Romanian, Russian, Spanish, Swahili, Swedish, Tamil, Telugu, Thai, Ukrainian, Urdu, and Vietnamese. For image retrieval, it [...] The Nemotron-3.5-Embed-8B-BF16 is suitable for users who want to build a multimodal question-and-answer application over a large corpus, leveraging the latest dense retrieval technology. The input of the model is a text or document image and the output is a fixed-size embedding vector. The embedding model is a bi-encoder that supports context in textual format (e.g. the query or the OCR text of a page or a section of a document) or the image of a document page. Typically, the embedding model is used first to embed (vectorize) the whole corpus (document images or text chunks), and embeddings are stored in a vector database associated to its raw content (image or text). Then at inference time, the embedding model is used to embed the query. The model generates dense vector embeddings from

Source: [nemotron-3.5-embed-8b Model by NVIDIA | NVIDIA NIM](https://build.nvidia.com/nvidia/nemotron-3_5-embed-8b/modelcard)

### 7. Overview - Nebius Token Factory documentation

- URL: <https://docs.tokenfactory.nebius.com/ai-models-inference/overview>
- Score: 0.5559422

Inference

# Overview

Get an inference engine overview

With Nebius Token Factory, you can test and deploy open-source AI models for generative language processing tasks, such as building virtual assistants and chatbots.
See the full list of available models in Nebius Token Factory.
Both deliver identical model outputs. Differences lie in token pricing, latency, and the level of applied optimizations. The Fast flavor uses smaller batch sizes, increased compute allocation, and techniques such as speculative decoding to reduce latency and improve responsiveness. To use the Fast flavor, append

## Available models

Nebius Token Factory supports the following model types:

## Text-to-text

## Embedding

## Vision

## Model flavors [...] ## Text-to-text

## Embedding

## Vision

## Model flavors

Inference performance is determined by how the endpoint is configured - balancing:

 Batch size
 GPU type (L40, H100, H200, B200)
 GPU count
 Inference-time optimizations (e.g., speculative decoding)

## Base

## Fast

```
-fast
```

to the model name in the API. These flavors are curated based on infrastructure and model-level expertise. For more specific needs - such as strict latency budgets, cost-efficiency targets, or high-throughput applications - endpoint configurations can be tailored to the customer use case through direct collaboration with the sales and solutions engineering team.

## Inference optimisations [...] ## Continuous Batching

A method that batches multiple input sequences together, increasing throughput by reducing the overhead of individual requests.

## Context Caching

A caching mechanism that stores the context (i.e., the output of previous layers) for each input sequence, reducing the number of computations required.

## Speculative decoding

An advanced technique that uses auxiliary models to pre-generate likely next tokens. The main model verifies these predictions, reducing the number of forward passes required and improving throughput without degrading output quality.

### Impact on model quality

Source: [Overview - Nebius Token Factory documentation](https://docs.tokenfactory.nebius.com/ai-models-inference/overview)

### 8. Alibaba launches Qwen3-Embedding and Qwen3-Reranker series for multilingual text embedding

- URL: <https://www.investing.com/news/stock-market-news/alibaba-launches-qwen3embedding-and-qwen3reranker-series-for-multilingual-text-embedding-93CH-4085139>
- Score: 0.5112048

The Qwen3-Embedding series offers a range of sizes for both embedding and reranking models, catering to various use cases that prioritize efficiency and effectiveness. The 8B size embedding model ranks No.1 in the MTEB multilingual leaderboard as of June 5, 2025, with a score of 70.58. The reranking models excel in text retrieval scenarios, significantly improving search relevance.

The Qwen3-Embedding series supports over 100 languages, including various programming languages, and provides robust multilingual, cross-lingual, and code retrieval capabilities. The models are designed using dual-encoder and cross-encoder architectures and aim to fully preserve and enhance the text understanding capabilities of the base model. [...] © Reuters.

In this article:

BABA-1.41%

Investing.com --  Alibaba  (NYSE:BABA) has launched the Qwen3-Embedding and Qwen3-Reranker series, setting new benchmarks in multilingual text embedding and relevance ranking. The series, which includes models designed for text embedding, retrieval, and reranking tasks, supports 119 languages and is available in 0.6B, 4B, and 8B versions.

The Qwen3-Embedding and Qwen3-Reranker series are built on the Qwen3 foundation model, which boasts robust multilingual text understanding capabilities. These new models have achieved state-of-the-art performance across multiple benchmarks for text embedding and reranking tasks. They are open-sourced under the Apache 2.0 license on Hugging Face, GitHub, and ModelScope, and can be used via API on Alibaba Cloud.

Source: [Alibaba launches Qwen3-Embedding and Qwen3-Reranker series for multilingual text embedding](https://www.investing.com/news/stock-market-news/alibaba-launches-qwen3embedding-and-qwen3reranker-series-for-multilingual-text-embedding-93CH-4085139)
