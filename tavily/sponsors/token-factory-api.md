---
question: "How does the Nebius Token Factory API work (OpenAI compatibility, base URL, embeddings, batch)?"
query: "Nebius Token Factory API OpenAI compatible base URL embeddings batch"
fetchedAt: "2026-10-30T14:26:56.159Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://llmendpoint.com/providers/nebius-token-factory"
  - "https://docs.tokenfactory.nebius.com/api-reference/introduction"
  - "https://european-alternatives.eu/product/nebius-token-factory"
  - "https://strandsagents.com/docs/integrations/model-providers/nebius-token-factory"
  - "https://alphasignal.ai/news/nebius-turns-token-factory-into-runnable-ai-recipes-for-developers"
  - "https://docs.tokenfactory.nebius.com/ai-models-inference/overview"
---
# How does the Nebius Token Factory API work (OpenAI compatibility, base URL, embeddings, batch)?


Query: `Nebius Token Factory API OpenAI compatible base URL embeddings batch` (Tavily advanced search, fetched 2026-10-30T14:26:56.159Z)



## Answer

The Nebius Token Factory API is described as being compatible with the OpenAI style, allowing developers to reuse existing SDK code with a different base URL and API key. The base URL for the API is not explicitly provided in the sources, but it is indicated that the base URL should be set to an empty string. The API supports batch processing and offers a variety of models for tasks such as chat completions, embeddings, and text generation. The sources do not provide a definitive answer to the specific base URL.

## Results (6)

### 1. Nebius Token Factory API: Pricing, Models & Alternatives | LLMEndpoint

- URL: <https://llmendpoint.com/providers/nebius-token-factory>
- Score: 0.7944651

Open comparisonReview pricing

## Developer access & rate limits

Practical integration and operations guidance.

## SDKs & integration

OpenAI-compatible endpoints usually let you reuse the OpenAI SDK (or any OpenAI-style client) with a different base URL and API key.

Read the docs

## Rate limits

Rate limits, quotas, and throughput tiers are provider and plan specific. Check the official documentation and status page before you size production traffic, and design for retry and fallback behavior.

## Pros

 Broad catalog of open models (text, vision, embeddings, image generation)
 1M-token context on flagship models
 EU data centers (Finland, Paris)
 Batch inference for large jobs

## Cons [...] Expand pricing notes

Pay-as-you-go per-token pricing; Nebius says Token Factory pricing is up to 50% lower than other big-name providers. Verify model-level pricing before production use.

Starting point: See model-level pricing

Pricing changes frequently. Verify current pricing on the provider's official site.

Open pricing page

## Endpoint reference

OpenAI-compatible request shape

`POST /v1/chat/completions`Compatibility claims still need model-by-model validation before migration.

## API Compatibility

Documents an OpenAI-compatible or OpenAI-style API path.

Because it is OpenAI-compatible, you can often reuse existing OpenAI SDK code with a base URL and key change. See the OpenAI-Compatible APIs category for migration and compatibility notes across providers.

streamingbatch [...] Skip to content

AI Inference Platforms

# Nebius Token FactoryAPI Review

Nebius Token Factory (formerly Nebius AI Studio) is a serverless, OpenAI-compatible inference platform for open models — text, vision, embeddings and text-to-image — with dedicated endpoints and post-training for production workloads. Flagship models shown include Kimi K3, MiniMax M3, Nemotron 3 Ultra and DeepSeek V4 Pro.

Visit websiteRead docsEstimate cost

## Should you shortlist Nebius Token Factory?

Source: [Nebius Token Factory API: Pricing, Models & Alternatives | LLMEndpoint](https://llmendpoint.com/providers/nebius-token-factory)

### 2. Introduction - Nebius Token Factory documentation

- URL: <https://docs.tokenfactory.nebius.com/api-reference/introduction>
- Score: 0.78611463

API Documentation

# Introduction

Nebius Token Factory offers an OpenAI-compatible API for inference and fine-tuning.

```

```
import os from openai import OpenAI  client = OpenAI(  base_url="  api_key=os.environ.get("NEBIUS_API_KEY"), )  completion = client.chat.completions.create(  model="meta-llama/Meta-Llama-3.1-70B-Instruct",  messages=[  {  "role": "user",  "content": """Hello!"""  }  ],  temperature=0.6 )  print(completion.to_json()) 
```

```

```

```
curl ' \  -X 'POST' \  -H 'Content-Type: application/json' \  -H 'Accept: /' \  -H "Authorization: Bearer $NEBIUS_API_KEY" \  --data-binary '{"temperature":0.6,"model":"meta-llama/Meta-Llama-3.1-70B-Instruct","messages":[{"role":"user","content":"Hello!"}]}' 
```

```

``` [...] ```

```

```
const OpenAI = require("openai"); const client = new OpenAI({  baseURL: "  apiKey: process.env.NEBIUS_API_KEY, });  client.chat.completions.create({  "temperature": 0.6,  "model": "meta-llama/Meta-Llama-3.1-70B-Instruct",  "messages": [  {  "role": "user",  "content": "Hello!"  }  ] }) .then((completion) => console.log(completion)); 
```

```

### Response

Response

```

Source: [Introduction - Nebius Token Factory documentation](https://docs.tokenfactory.nebius.com/api-reference/introduction)

### 3. Nebius Token Factory | European Alternatives

- URL: <https://european-alternatives.eu/product/nebius-token-factory>
- Score: 0.74807674

Nebius Token Factory logo

# Nebius Token Factory

Flag of Netherlands Netherlands EU  EU hosted

Website

Nebius Token Factory provides managed inference for open-source language models through an OpenAI-compatible API. Developers can use it for chat completions, reasoning, code generation, embeddings, and related application workloads without managing model-serving infrastructure. Its public serverless endpoints use token-based billing, while optional dedicated endpoints provide reserved capacity and regional deployment controls. The service supports API-key authentication, a browser-based playground, and model-specific performance tiers.

## Pricing [...] Flag of France France EU  EU hosted

Website

OVHcloud AI Endpoints is a managed generative AI API service from France. It gives developers serverless access to pre-trained language, reasoning, vision, embedding, image, and speech models without requiring them to deploy inference infrastructure. Its OpenAI-compatible chat-completions and responses routes support common application patterns including text generation, structured output, and function calling. Access can be authenticated with API keys, and usage is billed according to the selected model.

Read more  about OVHcloud AI Endpoints

See more APIs")

## Any suggestions?

Sign up for an account to suggest changes or new products.

 Sign Up [...] Other products in category Large language model (LLM) APIs

Scaleway Generative APIs logo

## Scaleway Generative APIs

Flag of France France EU  EU hosted   Free plan

Website

Scaleway Generative APIs is a managed model-inference service from France. Its serverless APIs provide OpenAI-compatible access to language, reasoning, vision, audio, embedding, and reranking models, while dedicated deployments can serve curated or customer-selected models. Text-generation endpoints support chat completions, structured outputs, tool calling, streaming, and batch processing. Serverless usage is billed by token or task and includes an ongoing free tier.

Read more  about Scaleway Generative APIs

OVHcloud AI Endpoints logo

## OVHcloud AI Endpoints

Flag of France France EU  EU hosted

Website

Source: [Nebius Token Factory | European Alternatives](https://european-alternatives.eu/product/nebius-token-factory)

### 4. Nebius Token Factory | Strands Agents

- URL: <https://strandsagents.com/docs/integrations/model-providers/nebius-token-factory>
- Score: 0.7316155

API key: from the Token Factory Console
 Base URL: `

Model IDs come from the Token Factory model catalog, for example `deepseek-ai/DeepSeek-R1-0528` or `meta-llama/Meta-Llama-3.1-70B-Instruct`. For model parameters and other provider options, see the OpenAI provider guide.

## References

Section titled “References”

 Nebius Token Factory documentation
 Nebius Token Factory API reference
 OpenAI provider [...] Skip to content

# Nebius Token Factory

Nebius Token Factory provides fast inference for open-source language models.

## Installation

Section titled “Installation”

The OpenAI provider is an optional dependency. To install, run:

 Python
 TypeScript

Terminal window

```

pip install 'strands-agents[openai]'

```

Terminal window

```

npm install @strands-agents/sdk openai

```

## Usage

Section titled “Usage”

Create an API key in the Nebius Token Factory Console, export it as `NEBIUS_API_KEY`, and point the provider at the Token Factory endpoint:

 Python
 TypeScript

```

import os

from strands import Agent

from strands.models.openai import OpenAIModel

model = OpenAIModel(

client_args={

"api_key": os.environ["NEBIUS_API_KEY"],

"base_url": "

}, [...] "base_url": "

},

model_id="deepseek-ai/DeepSeek-R1-0528",

)

agent = Agent(model=model)

response = agent("Explain tool calling in one sentence.")

print(response)

```

```

import { Agent } from '@strands-agents/sdk'

import { OpenAIModel } from '@strands-agents/sdk/models/openai'

const model = new OpenAIModel({

api: 'chat',

apiKey: process.env.NEBIUS_API_KEY,

clientConfig: {

baseURL: '

},

modelId: 'deepseek-ai/DeepSeek-R1-0528',

const agent = new Agent({ model })

const response = await agent.invoke('Explain tool calling in one sentence.')

console.log(response)

```

## Configuration

Section titled “Configuration”

Two client settings connect the provider to Nebius Token Factory:

 API key: from the Token Factory Console
 Base URL: `

Source: [Nebius Token Factory | Strands Agents](https://strandsagents.com/docs/integrations/model-providers/nebius-token-factory)

### 5. Nebius Turns Token Factory Into Runnable AI Recipes for Developers | AlphaSignal

- URL: <https://alphasignal.ai/news/nebius-turns-token-factory-into-runnable-ai-recipes-for-developers>
- Score: 0.72768575

Nebius has expanded its Token Factory companion project into a broad collection of production-oriented examples. The MIT-licensed cookbook repository contains Jupyter notebooks and runnable applications covering API access, agents, retrieval-augmented generation, fine-tuning, distillation, structured output, and media generation.

Its OpenAI-compatible interface lets developers reuse familiar SDK request formats while directing traffic to hosted open-weight models. Switching providers can require only a new base URL, API key, and model name, although provider-specific features and response formats may still require code changes.

## One repo, six layers [...] SubtopicCode Agents · Code Generation

 Nebius published an open cookbook of notebooks for its Token Factory inference platform.
 Covers agents in CrewAI, LangChain, Agno, Google ADK, Pydantic AI, LlamaIndex, and AWS Strands.
 RAG examples pair Qwen3 embeddings with Milvus, Qdrant, or Weaviate vector stores.
 Includes LoRA fine-tuning, full post-training, and a worked distillation example for grammar checking.
 Backed by an OpenAI-compatible API supporting DeepSeek, GPT-OSS, Llama, Nemotron, and Qwen.
 MIT-licensed and available on GitHub with 260+ commits.

Source: [Nebius Turns Token Factory Into Runnable AI Recipes for Developers | AlphaSignal](https://alphasignal.ai/news/nebius-turns-token-factory-into-runnable-ai-recipes-for-developers)

### 6. Overview - Nebius Token Factory documentation

- URL: <https://docs.tokenfactory.nebius.com/ai-models-inference/overview>
- Score: 0.7062922

## Generation parameters

You can tune the model’s generation parameters to adapt outputs for your use case and optimize performance or cost. Nebius Token Factory supports most of OpenAI compatible generation parameters. Supported parameters vary by interface:

 Playground - Supports the most commonly used parameters.
 API - Supports the full set of vLLM parameters.

Was this page helpful? [...] ## Text-to-text

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

## Inference optimisations

Source: [Overview - Nebius Token Factory documentation](https://docs.tokenfactory.nebius.com/ai-models-inference/overview)
