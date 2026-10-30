---
question: "Under what license are Nemotron models and training data released?"
query: "NVIDIA Nemotron open model license training data Hugging Face"
fetchedAt: "2026-10-30T14:27:29.895Z"
tool: tavily
searchDepth: basic
searchTopic: general
mode: search
creditsUsed: 1
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://huggingface.co/datasets/nvidia/Nemotron-CC-v2"
  - "https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16"
  - "https://huggingface.co/blog/nvidia/nemotron-open-models-data"
  - "https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html"
  - "https://blogs.nvidia.com/blog/nvidia-to-acquire-hugging-face"
---
# Under what license are Nemotron models and training data released?


Query: `NVIDIA Nemotron open model license training data Hugging Face` (Tavily basic search, fetched 2026-10-30T14:27:29.895Z)



## Answer

The sources indicate that the NVIDIA Nemotron open model license training data on Hugging Face is intended for use by the community to improve open models, with the data freely usable under an open data license. The datasets used for training include synthetic data created using various models, and the datasets are permissively licensed for model training purposes. The datasets are available on Hugging Face and GitHub, and the training environments and post-training foundation for Nemotron models are provided by open-source libraries released by NVIDIA.

## Results (5)

### 1. nvidia/Nemotron-CC-v2 · Datasets at Hugging Face

- URL: <https://huggingface.co/datasets/nvidia/Nemotron-CC-v2>
- Score: 0.85538095

The NVIDIA Data Access Agreement for Model Training enables training of any AI model, including models released under proprietary or open source licenses.

This dataset contains synthetic data created using the following models: [...] ## Intended use

The Nemotron Pre-Training Dataset is intended to be used by the community to continue to improve open models. The data may be freely used to train and evaluate with user agreement to open data license.

## Ethical Considerations: [...] | Model | Token Count (B) |
 --- |
| Mistral-Nemo-12B-Instruct | 1629.1 |
| Qwen3-30B-A3B | 879.1 |
| Without using LLM | 3359.8 |

## License/Terms of Use

NVIDIA Data Agreement for Model Training

Source: [nvidia/Nemotron-CC-v2 · Datasets at Hugging Face](https://huggingface.co/datasets/nvidia/Nemotron-CC-v2)

### 2. nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16 · Hugging Face

- URL: <https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16>
- Score: 0.8455478

`--max-model-len 1048576`
`--context-length 1048576`
`--max-model-len 1048576`

## Model Overview

Model Developer: NVIDIA Corporation

Model Dates: December 2025 - May 2026

Data Freshness:

### What is Nemotron?

NVIDIA Nemotron™ is a family of open models with open weights, training data, and recipes, delivering leading efficiency and accuracy for building specialized AI agents.

## Description [...] Alongside the model, we release our final pre-training and post-training data, as outlined in this section. For ease of analysis, there is a sample set that is ungated. For all remaining code, math and multilingual data, gating and approval is required, and the dataset is permissively licensed for model training purposes.

For more information about the datasets used to train this model, please see the Public Summary of Training Content

#### Base Pre-Training Corpus (Nemotron 3 Foundation) [...] During post-training, we generate synthetic data by distilling trajectories, solutions, and translations from strong teacher models and agent systems, often grounded in real tasks or documents and aggressively filtered for quality. For math, code, and science, we start from curated problem sets and use open source permissive models such as GPT-OSS-120B to produce step-by-step reasoning traces, candidate solutions, best-of-n selection traces, and verified CUDA kernels. For long-context and

Source: [nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16 · Hugging Face](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-BF16)

### 3. Nemotron’s Open Secret: Accelerating AI Development with Open Models, Data, and Recipes

- URL: <https://huggingface.co/blog/nvidia/nemotron-open-models-data>
- Score: 0.7898345

This “data flywheel” approach means developers can train faster, cheaper, and with higher accuracy, continuously improving performance through better data.

## Open Datasets for AI Development

NVIDIA makes its pretraining and post-training datasets available on Hugging Face so developers can inspect the underlying data and use it to train their own models. [...] Why it matters: Because you can inspect the data, modify the models, and deploy them however you want.

Key breakthroughs:

For developers:
Use Nemotron as your foundation for custom AI. From fine-tuning enterprise copilots to deploying agentic systems at the edge.

Run, adapt, and extend: everything you need including models and datasets, is open on huggingface.co/nvidia

Help us define the future, vote for Nemotron features we should prioritize on our roadmap. [...] Hugging Face's logo

# Nemotron’s Open Secret: Accelerating AI Development with Open Models, Data, and Recipes

Bryan Catanzaro's avatar
NVIDIA's avatar
Jonathan Cohen's avatar
NVIDIA's avatar

Source: [Nemotron’s Open Secret: Accelerating AI Development with Open Models, Data, and Recipes](https://huggingface.co/blog/nvidia/nemotron-open-models-data)

### 4. NVIDIA debuts Nemotron 3 open-model family for AI agents | NVDA Stock News

- URL: <https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html>
- Score: 0.7742597

To accelerate development, NVIDIA released the NeMo Gym and NeMo RL open-source libraries, which provide the training environments and post-training foundation for Nemotron models, along with NeMo Evaluator to validate model safety and performance. All tools and datasets are now available on GitHub and Hugging Face. [...] Nemotron 3 is supported by LM Studio, llama.cpp, SGLang and vLLM. In addition, Prime Intellect and Unsloth are integrating NeMo Gym’s ready-to-use training environments directly into their workflows, giving teams faster, easier access to powerful reinforcement learning training.

Get Started With NVIDIA Open Models  
Nemotron 3 Nano is available today on Hugging Face and through inference service providers including Baseten, DeepInfra, Fireworks, FriendliAI, OpenRouter and Together AI. [...] NVIDIA released NeMo Gym, NeMo RL, NeMo Evaluator and a 3 trillion-token corpus plus agentic safety datasets, on GitHub and Hugging Face.

## Keep reading

### More on NVDA

 NVIDIA Expands Open Source CUDA-Q Platform for Fault-Tolerant Quantum Computing Sep 14, 2026
 NVIDIA and Palantir Bring Sovereign Intelligence to Critical Supply Chains Sep 10, 2026
 NVIDIA Expands AI Infrastructure Capacity in Partnership With Australia’s Data Center Ecosystem Sep 9, 2026

### Trending in the feed

Source: [NVIDIA debuts Nemotron 3 open-model family for AI agents | NVDA Stock News](https://www.stocktitan.net/news/NVDA/nvidia-debuts-nemotron-3-family-of-open-wbn7g844bc22.html)

### 5. NVIDIA to Acquire Hugging Face | NVIDIA Blog

- URL: <https://blogs.nvidia.com/blog/nvidia-to-acquire-hugging-face>
- Score: 0.7092009

NVIDIA is the largest contributor of open models and data to Hugging Face, and our contributions continue to grow.
 NVIDIA has released more than 500 models on Hugging Face and more than 250 open datasets.
 We build our own models, libraries and tools in the open so developers everywhere can use them, modify them and build on top of them. [...] NVIDIA has been committed to open weight models for years, demonstrated by multiyear investments and major contributions to open source platforms, including Hugging Face. NVIDIA has said that open models, data and tools broaden access to AI, and it has contributed hundreds of open models and datasets to Hugging Face as part of that effort.

Source: [NVIDIA to Acquire Hugging Face | NVIDIA Blog](https://blogs.nvidia.com/blog/nvidia-to-acquire-hugging-face)
