---
question: "How is Nebius Token Factory priced per million tokens?"
query: "Nebius Token Factory pricing per million tokens Nemotron"
fetchedAt: "2026-10-30T14:27:07.076Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://nebius.com/blog/posts/three-new-open-weight-models-from-us-companies-give-builders-more-choice"
  - "https://custom.typingmind.com/tools/estimate-llm-usage-costs/nebius/glm-5"
  - "https://www.linkedin.com/posts/lanteigneadam_scaling-efficient-production-grade-inference-activity-7429978846332096512-NeMZ"
  - "https://www.stocktitan.net/news/NBIS/nebius-ai-studio-a-high-performing-inference-as-a-service-platform-cbkaqs9c93f4.html"
  - "https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680"
  - "https://nebius.com/blog/posts/nemotron3-super-now-available"
---
# How is Nebius Token Factory priced per million tokens?


Query: `Nebius Token Factory pricing per million tokens Nemotron` (Tavily advanced search, fetched 2026-10-30T14:27:07.076Z)



## Answer

The sources provide varying pricing details for Nemotron 3.5 Super VL on Nebius Token Factory. One source states 0.30 USD per million input tokens and 0.90 USD per million output tokens. Another source mentions $1.00/1M input tokens and $3.20/1M output tokens for GLM-5, which is a model by Nebius Token Factory. Additionally, another source indicates $1/M input tokens and $3/M output tokens for Llama 3.1 405B on Nebius AI Studio, which also supports Nemotron 3.5 Super VL. The sources do not provide a definitive answer for the exact pricing of Nemotron 3.5 Super VL.

## Results (6)

### 1. Three new open-weight models from US companies give builders more choice

- URL: <https://nebius.com/blog/posts/three-new-open-weight-models-from-us-companies-give-builders-more-choice>
- Score: 0.8943568

On Token Factory: 0.30 USD per million input tokens and 0.90 USD per million output tokens. Try Nemotron 3.5 Super VL.

## Compare them with what you already runCompare them with what you already run

Token Factory serves all three through an OpenAI-compatible API. The loop below sends the same text prompt to each model and reports response time and token usage. Add the model you use today to the list as a baseline. This text-only loop does not test image or video inputs, or tool use. Save a representative prompt as

```
task.md
```

, install the OpenAI Python package, and set

```
NEBIUS_API_KEY
```

before running it. The Token Factory quickstart shows how to create an API key.

``` [...] Try it first on a debugging task that spans several files. Judge the whole run: did it find the right files, call the right tools, and land a fix you would merge? Then add a screenshot of the failing UI and see whether the outcome changes.

On Token Factory: 1.25 USD per million input tokens and 4.25 USD per million output tokens. Try Muse Spark Open.

## NVIDIA Nemotron 3.5 Super VL: agents that work from what they seeNVIDIA Nemotron 3.5 Super VL: agents that work from what they see [...] Each model fits a different kind of agent work.

 Beam is a text-only coding and reasoning model with adjustable reasoning effort, priced at $0.25 per million input tokens.
 Muse Spark Open, an open weights release from Meta, is built for multi-file coding and tool use, and accepts text, image, and video input via API.
 Nemotron 3.5 Super VL brings visual understanding to documents and web content, with 12 billion active parameters.

All three are mixture-of-experts models served through the same OpenAI-compatible API.

Source: [Three new open-weight models from US companies give builders more choice](https://nebius.com/blog/posts/three-new-open-weight-models-from-us-companies-give-builders-more-choice)

### 2. Nebius Token Factory GLM-5 API Pricing Calculator

- URL: <https://custom.typingmind.com/tools/estimate-llm-usage-costs/nebius/glm-5>
- Score: 0.85509074

DeepSeek V4 Pro 0813

$1.32in · $3.96outNemotron 3.5 Lightning 30B A3B

Nemotron 3.5 Lightning 30B A3B

$0.0600in · $0.2400out

View all models

## Frequently Asked Questions

### How much does GLM-5 cost to use?

GLM-5 is priced at $1.00/1M input tokens and $3.20/1M output tokens. Use the cost estimator on this page to calculate your expected spend based on your usage pattern.

### What is a token and how does it relate to pricing?

A token is a chunk of text — roughly ¾ of a word in English. For example, "chatbot" is two tokens. LLM API pricing is based on the number of tokens you send (input) and receive (output). Input tokens include your prompts, uploaded documents, and images, while output tokens are the model's generated responses. [...] TypingMind TeamsTypingMind Teams

Sign inTry for free

1. Free Tools
2. /
3. LLM Cost Estimator
4. /
5. Nebius Token Factory
6. /
7. GLM-5

GLM-5

# GLM-5via Nebius Token Factory

Context Window

200,000 tokens

Release Date

Capabilities

ReasoningTool callingStructured outputTemperature

Availability

Proprietary API

## Model Overview

Nebius (formerly Yandex Cloud AI) provides AI inference services through their Token Factory platform, offering European-hosted model access with competitive pricing.

GLM-5 is a model by Nebius Token Factory with a 200k token context window and up to 16k output tokens. It is priced at $1.00/1M input tokens and $3.20/1M output tokens. [...] Key capabilities include: reasoning, tool calling, structured output, temperature.It supports advanced reasoning for complex multi-step tasks.It can call external tools and functions for agentic workflows.

## Details

ProviderNebius Token Factory

Model IDzai-org/GLM-5

FamilyN/A

Release Date2026-03-01

Last Updated2026-03-10

Knowledge Cutoff2026-01

Context Window200,000 tokens

Max Output16,384 tokens

Input Cost / 1M$1.00

Output Cost / 1M$3.20

Cache Read / 1M$0.1000

Cache Write / 1M$1.00

## More models from Nebius Token Factory

DeepSeek V4.1 Flash

DeepSeek V4.1 Flash

$0.3000in · $1.20outGLM-5.3-Flash

GLM-5.3-Flash

$0.1500in · $0.5000outQwen3.8 27B

Qwen3.8 27B

$0.4500in · $3.00outGLM-5.3

GLM-5.3

$1.40in · $4.40outDeepSeek V4 Pro 0813

DeepSeek V4 Pro 0813

Source: [Nebius Token Factory GLM-5 API Pricing Calculator](https://custom.typingmind.com/tools/estimate-llm-usage-costs/nebius/glm-5)

### 3. Optimizing Inference Costs with Nebius | Adam Lanteigne ...

- URL: <https://www.linkedin.com/posts/lanteigneadam_scaling-efficient-production-grade-inference-activity-7429978846332096512-NeMZ>
- Score: 0.854509

While GPT-4o or Claude 3.5 might cost $5–$15 per million tokens, running Nemotron 3 Super on a company's own hardware or a dedicated cloud

Source: [Optimizing Inference Costs with Nebius | Adam Lanteigne ...](https://www.linkedin.com/posts/lanteigneadam_scaling-efficient-production-grade-inference-activity-7429978846332096512-NeMZ)

### 4. Nebius AI Studio Delivers 50% Lower Pricing, Rivals GPT-4 Performance with Llama 3.1 | NBIS Stock News

- URL: <https://www.stocktitan.net/news/NBIS/nebius-ai-studio-a-high-performing-inference-as-a-service-platform-cbkaqs9c93f4.html>
- Score: 0.604703

### How does Nebius AI Studio's pricing compare to competitors?

Nebius AI Studio offers Llama 3.1 405B at $1/M input tokens and $3/M output tokens, with pricing up to 50% lower than other major providers in the market.

### Where are Nebius AI Studio's endpoints located?

Nebius AI Studio's endpoints are currently hosted in data centers in Finland and Paris, with plans to build their first GPU cluster in the United States.

### What open-source models does Nebius AI Studio support?

Nebius AI Studio supports various open-source models including the Llama 3.1 and Mistral families, Nemo, Qwen, Llama OpenbioLLM, and upcoming text-to-image and text-to-video models.

## Keep reading

### More on NBIS [...] Artificial Analysis evaluates the end-to-end performance of LLM inference services such as Nebius AI Studio on the real-world experience of customers to provide benchmarks for AI model users. Nebius' endpoints are hosted in data centers located in Finland and Paris. The company is also building its first GPU cluster in the U~~.~~S and adding offices nationwide to serve customers across the country.

George Cameron, co-founder of Artificial Analysis, added:

"In our independent benchmarks of Nebius' endpoints, results show they are amongst the most competitive in terms of price. In particular, Nebius is offering Llama 3.1 405B, Meta's leading model, at $1/M input tokens and $3/M output tokens, making it one of the most affordable endpoints for accessing a frontier model." [...] Nebius AI Studio offers app builders access to an extensive and constantly growing library of leading open-source models – including the Llama 3.1 and Mistral families, Nemo, Qwen, and Llama OpenbioLLM, as well as upcoming text-to-image and text-to-video models  – with per - token pricing, enabling the creation of fast, low-latency applications at an affordable price.

Artificial Analysis assessed key metrics including quality, speed, and price across all endpoints on the Nebius Studio AI platform. The results revealed that the open-source models available on Nebius AI Studio deliver one of the most competitive offerings in the market, with the Llama 3.1 Nemotron 70B and Qwen 2.5 72B models in the most attractive quadrant of the Output Speed vs. Price chart.

Photo - 

Source:

Source: [Nebius AI Studio Delivers 50% Lower Pricing, Rivals GPT-4 Performance with Llama 3.1 | NBIS Stock News](https://www.stocktitan.net/news/NBIS/nebius-ai-studio-a-high-performing-inference-as-a-service-platform-cbkaqs9c93f4.html)

### 5. Nebius launches token factory platform for open-source AI models

- URL: <https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680>
- Score: 0.56920683

More News

Market Movers

Most Active Gainers %Losers %

| Name | Last | Chg. % | Vol. |  |
 ---  --- 
| RBC | 281.77 | -0.36% | 2.98M |  |
| TD | 174.47 | -0.38% | 3.66M |  |
| Suncor Energy | 111.18 | +2.57% | 4.39M |  |
| TC Energy | 87.32 | +0.53% | 5.14M |  |
| Canadian Natural | 77.12 | +2.15% | 4.93M |  |
| National Bank of Canada | 204.96 | -1.13% | 1.74M |  |
| Shopify Inc | 236.24 | -0.07% | 1.43M |  | [...] | Name | Last | Chg. % | Vol. |  |
 ---  --- 
| Mijem Newcomm Tech | 0.10 | +375.00% | 27.00K |  |
| Green Scientific Labs Holdings | 0.06 | +120.00% | 15.00K |  |
| First Growth Funds | 0.03 | +100.00% | 70.00K |  |
| Galore Resources | 0.0200 | +100.00% | 127.00K |  |
| Appili Therapeutics | 0.0100 | +100.00% | 1.50K |  |
| ePlay Digital | 0.010 | +100.00% | 7.00K |  |
| Biosenta Inc | 0.080 | +100.00% | 6.00K |  | [...] | Name | Last | Chg. % | Vol. |  |
 ---  --- 
| Hercules Resources | 0.02 | -73.33% | 15.34K |  |
| Carson River Ventures | 0.03 | -70.00% | 3.00K |  |
| Lanebury Growth Capital | 0.06 | -63.33% | 4.00K |  |
| Modern Plant Based Foods | 0.070 | -61.11% | 2.00K |  |
| Pegasus Mercantile | 0.0300 | -53.85% | 1.85K |  |
| Ramm Pharma | 0.01 | -50.00% | 27.00K |  |
| Nobel Resources | 0.02 | -50.00% | 569.00K |  |

Advertisement

## Trending Stocks

| Name | Last | Chg. % | Vol. |  |
 ---  --- 
| Celestica Inc. | 364.40 | -3.26% | 552.31K |  |
| Hut 8 | 85.750 | -4.32% | 585.48K |  |
| Air Canada | 21.11 | -4.65% | 2.76M |  |
| Canadian Natural | 77.12 | +2.15% | 4.93M |  |
| Telus | 12.34 | -0.24% | 7.77M |  |

Show more

Advertisement

ProPicks AI

Source: [Nebius launches token factory platform for open-source AI models](https://ca.investing.com/news/company-news/nebius-launches-token-factory-platform-for-opensource-ai-models-93CH-4291680)

### 6. NVIDIA Nemotron 3 Super now available on Nebius Token Factory

- URL: <https://nebius.com/blog/posts/nemotron3-super-now-available>
- Score: 0.5446325

# NVIDIA Nemotron 3 Super now available on Nebius Token Factory

NVIDIA Nemotron 3 Super now available on Nebius Token Factory

NVIDIA Nemotron 3 Super is now available on Nebius Token Factory.

Nemotron 3 Super is a 120B parameter hybrid MoE model optimized for multi-agent applications and complex reasoning workflows. With 12B active parameters per inference step and up to 1M token context length, it is designed for long-horizon planning, tool calling and high-accuracy instruction following.

## Built for agentic systemsBuilt for agentic systems

Nemotron 3 Super combines a hybrid Transformer–Mamba architecture with mixture-of-experts routing to improve compute efficiency while maintaining strong reasoning performance.

Key characteristics: [...] Key characteristics:

 120B parameters, 12B active;
 Up to 1M token context;
 Multi-Token Prediction for faster long-form generation;
 Open weights, open datasets and open training recipes;
 Text-in, text-out model inference.

The model targets production use cases such as:

 Software development workflows, including code generation and analysis;
 Deep research agents for long-horizon planning and reasoning;
 Financial document processing;
 Cybersecurity triage and threat intelligent analysis.

## Run NVIDIA Nemotron 3 Super in productionRun NVIDIA Nemotron 3 Super in production

On Nebius Token Factory, Nemotron 3 Super can be deployed via: [...] Dedicated GPU endpoints with guaranteed performance;
 Autoscaling throughput for production workloads;
 OpenAI-compatible API integration;
 EU or US regional deployment options;
 Optional zero-retention inference.

Token Factory enables teams to move from model access to production deployment without managing GPU clusters or inference infrastructure.

## Get startedGet started

Nemotron 3 Super is available today in the Nebius Token Factory console.

Deploy via API or test in the Playground. Build AI engineered for your product.

## Explore Nebius Token Factory

## See also

Source: [NVIDIA Nemotron 3 Super now available on Nebius Token Factory](https://nebius.com/blog/posts/nemotron3-super-now-available)
