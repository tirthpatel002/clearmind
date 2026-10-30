---
question: "What rate limits and quotas apply to Nebius Token Factory?"
query: "Nebius Token Factory rate limits quotas tokens per minute"
fetchedAt: "2026-10-30T14:26:59.203Z"
tool: tavily
searchDepth: basic
searchTopic: general
mode: search
creditsUsed: 1
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://docs.tokenfactory.nebius.com/ai-models-inference/rate-limits"
  - "https://xyzs996.github.io/free-llm-api/provider/nebius.html"
  - "https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html?fr=sycsrp_catchall"
  - "https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html"
  - "https://benchlm.ai/hosts/nebius"
---
# What rate limits and quotas apply to Nebius Token Factory?


Query: `Nebius Token Factory rate limits quotas tokens per minute` (Tavily basic search, fetched 2026-10-30T14:26:59.203Z)



## Answer

The sources indicate that Nebius Token Factory has dynamic rate limits and does not publish a fixed default limit. The documentation mentions that usage is evaluated in rolling 15-minute windows, and exceeding 80% of the current limit raises it by 20% for the next window. The sources also highlight that the maximum number of tokens permitted per minute is indicated in the response headers as `x-ratelimit-limit-tokens`. However, specific numerical limits are not provided, and the free tier's status is not confirmed to be going away as of the latest documentation date.

## Results (5)

### 1. Rate Limits & Scaling - Nebius Token Factory documentation

- URL: <https://docs.tokenfactory.nebius.com/ai-models-inference/rate-limits>
- Score: 0.82492816

```

### Rate Limit Response Headers

Here’s a simple explanation of response headers you can use to track you limits quotas:

### ShowDescription of Rate Limits response headers

ShowDescription of Rate Limits response headers

HeaderDescription

```
x-ratelimit-limit-requests
```

The maximum number of requests that are permitted per minute.

```
x-ratelimit-limit-tokens
```

The maximum number of tokens that are permitted per minute.

```
x-ratelimit-remaining-requests
``` [...] ```
1.00×
```

60400,000+ 15 min

```
1.20×
```

72480,000+ 30 min

```
1.44×
```

86576,000+ 1 h

```
2.07×
```

124828,000+ 2 h

```
4.30×
```

2581,720,000

### Monitoring your headroom and handling 429s

Your current rate limits are always visible in the API response headers, which are detailed further down. If you exceed the active limit you will receive HTTP 429. To avoid this, you can track your consumption against your limits using the

```
x-ratelimit-remaining-requests
```

and [...] Nebius AI Inference is elastic by design. When you gradually increase your workload we scale the capacity with you. Most teams on Startup Tier never need to think about rate limits—but when you start pushing tens of thousands of requests per minute it helps to know how the platform behaves. Sudden bursts of AI Model traffic may be subject to throttling. This page explains the dynamic rate‑limiting system, how it auto‑scales, and the knobs you can turn when you need more headroom.

Source: [Rate Limits & Scaling - Nebius Token Factory documentation](https://docs.tokenfactory.nebius.com/ai-models-inference/rate-limits)

### 2. Nebius Token Factory free tier: limits and models

- URL: <https://xyzs996.github.io/free-llm-api/provider/nebius.html>
- Score: 0.8145405

Limits are dynamic and the docs do not publish an account default: they tell you to read the Rate Limits page inside Token Factory. The 60 RPM / 400,000 TPM pair this catalog previously carried as a baseline appears on the page only inside a table labelled a visual example, so it is not quoted as a limit here. The published rules that do apply: usage is evaluated in rolling 15-minute windows, averaging at or above 80% of the current limit raises it by 20% for the next window, averaging at or [...] | Compared with | Published limits | Card | Endpoint |
 ---  --- |
| Nebius Token Factory (this page) | Dynamic, no fixed numbers | Not required | `api.tokenfactory.nebius.com` |
| Perplexity API | 50 requests per minute | Not required | `api.perplexity.ai` |
| DeepInfra | Enforced but not published | Not required | `api.deepinfra.com` |
| Chutes | Published per paid plan | Not required | `llm.chutes.ai` |

## Models Nebius Token Factory lists as free [...] The endpoint answers `429`. That is a statement about the request that was refused, not about how much quota is left; only a reset header from the provider tells you when it clears.

### Is the Nebius Token Factory free tier going away?

Nothing in Nebius Token Factory's own documentation says so as of 2026-08-22. Requests above the limit may still be served at lower priority, flagged with an x-ratelimit-over-limit header, rather than failing outright.

Source: [Nebius Token Factory free tier: limits and models](https://xyzs996.github.io/free-llm-api/provider/nebius.html)

### 3. Nebius Launches Nebius Token Factory to Deliver Production AI Inference at Scale

- URL: <https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html?fr=sycsrp_catchall>
- Score: 0.64047897

Nebius Token Factory empowers teams to realize these advantages by combining the flexibility of open models with the governance, performance and cost-efficiency needed to run AI at scale. It is optimized for efficiency, delivering sub-second latency, autoscaling throughput and 99.9% uptime, even for workloads exceeding hundreds of millions of requests per minute. [...] 1. Crypto
2. AI

This is a paid press release. Contact the press release distributor directly with any inquiries.

Business Wire

# Nebius Launches Nebius Token Factory to Deliver Production AI Inference at Scale

Business Wire

8 min read

 NBIS

  -5.68%
 OPAI.PVT
 NVDA

  -0.80% [...] "We move fast, test and iterate quickly, and the flexibility, products and quick responses from Nebius Token Factory allowed us to keep this pace all the way through production," said Zülküf Genç, Director of AI at Prosus. "By leveraging Nebius Token Factory's dedicated endpoints, Prosus was able to secure guaranteed performance and isolation. The addition of autoscaling was the game-changer, allowing us to handle massive workloads of up to 200 billion tokens per day without manual

Source: [Nebius Launches Nebius Token Factory to Deliver Production AI Inference at Scale](https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html?fr=sycsrp_catchall)

### 4. Nebius Launches Nebius Token Factory to Deliver Production AI Inference at Scale

- URL: <https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html>
- Score: 0.64047897

Nebius Token Factory empowers teams to realize these advantages by combining the flexibility of open models with the governance, performance and cost-efficiency needed to run AI at scale. It is optimized for efficiency, delivering sub-second latency, autoscaling throughput and 99.9% uptime, even for workloads exceeding hundreds of millions of requests per minute. [...] "We move fast, test and iterate quickly, and the flexibility, products and quick responses from Nebius Token Factory allowed us to keep this pace all the way through production," said Zülküf Genç, Director of AI at Prosus. "By leveraging Nebius Token Factory's dedicated endpoints, Prosus was able to secure guaranteed performance and isolation. The addition of autoscaling was the game-changer, allowing us to handle massive workloads of up to 200 billion tokens per day without manual [...] Exchange Commission ("SEC") on April 30, 2025.

Source: [Nebius Launches Nebius Token Factory to Deliver Production AI Inference at Scale](https://finance.yahoo.com/news/nebius-launches-nebius-token-factory-124100461.html)

### 5. Nebius Token Factory API Pricing: 27 Models, Per-Token Rates (October 2026) | BenchLM.ai

- URL: <https://benchlm.ai/hosts/nebius>
- Score: 0.64047897

Nebius Token Factory bills per million tokens, with separate input and output rates for each model. On October 20, 2026 its output rates ran from $0.24 on Nemotron-3-Nano-30B-A3B to $15.00 across 27 paid models. Input is usually cheaper than output, so a long prompt with a short reply costs less than the output rate suggests.

Which models can you run on Nebius Token Factory?+ [...] | GLM-5.3-Flashzai-org/GLM-5.3-Flash | 69 | $0.15 | $0.50 | — | 1.02M | 349 tok/s | — |
| DeepSeek-V4-Pro-0813deepseek-ai/DeepSeek-V4-Pro-0813 | 69 | $1.32 | $3.96 | — | 979K | 37 tok/s | Same |
| Reflection Beam 1.0reflection/beam | 68 | $0.25 | $1.00 | — | 1.05M | 389 tok/s | — |
| GLM-5.3zai-org/GLM-5.3 | 68 | $1.40 | $4.40 | — | 1.02M | 455 tok/s | — |
| Kimi-K2.6moonshotai/Kimi-K2.6 | 67 | $0.95 | $4.00 | — | 262K | 60 tok/s | Same | [...] | MiniMax-M3MiniMaxAI/MiniMax-M3 | 65 | $0.30 | $1.20 | — | 1.05M | 248 tok/s | Same |
| GLM-5.2zai-org/GLM-5.2 | 65 | $1.40 | $4.40 | — | 1.05M | 25 tok/s | Same |
| GLM-5.1zai-org/GLM-5.1 | 64 | $1.40 | $4.40 | — | 203K | 25 tok/s | Same |
| Kimi-K2.7-Codemoonshotai/Kimi-K2.7-Code | 63 | $0.95 | $4.00 | — | 262K | 231.26 tok/s | Same |
| DeepSeek-V4-Flash-0731deepseek-ai/DeepSeek-V4-Flash-0731 | 62 | $0.14 | $0.28 | — | 1.02M | 351 tok/s | Same |

Source: [Nebius Token Factory API Pricing: 27 Models, Per-Token Rates (October 2026) | BenchLM.ai](https://benchlm.ai/hosts/nebius)
