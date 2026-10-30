---
question: "What is the LongMemEval benchmark and what does it measure?"
query: "LongMemEval benchmark long-term memory chat assistants"
fetchedAt: "2026-10-30T14:27:56.983Z"
tool: tavily
searchDepth: basic
searchTopic: general
mode: search
creditsUsed: 1
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://www.alphaxiv.org/abs/2410.10813v1"
  - "https://github.com/xiaowu0162/longmemeval"
---
# What is the LongMemEval benchmark and what does it measure?


Query: `LongMemEval benchmark long-term memory chat assistants` (Tavily basic search, fetched 2026-10-30T14:27:56.983Z)



## Answer

The LongMemEval benchmark provides a comprehensive evaluation framework specifically designed for long-term memory in chat assistants, consisting of 500 meticulously curated questions covering five core memory abilities. It includes chat histories that can be scaled from 115,000 tokens (LONGMEMEVALS) to 1.5 million tokens (LONGMEMEVALM) and realistic, task-oriented dialogues. The benchmark aims to evaluate and improve long-term memory capabilities for chat assistants, highlighting the challenges current systems face in maintaining effective long-term memory. The research demonstrates that while large language model-driven chat assistant systems have integrated memory components to track user-assistant chat histories, their long-term memory capabilities in sustained interactions remain underexplored.

## Results (2)

### 1. LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory | alphaXiv

- URL: <https://www.alphaxiv.org/abs/2410.10813v1>
- Score: 0.9365236

The LONGMEMEVAL benchmark addresses these limitations by providing a comprehensive evaluation framework specifically designed for long-term memory in chat assistants. The benchmark consists of:

 500 meticulously curated questions covering five core memory abilities
 Chat histories that can be scaled from 115,000 tokens (LONGMEMEVALS) to 1.5 million tokens (LONGMEMEVALM)
 Realistic, task-oriented dialogues that reflect typical user-assistant interaction patterns [...] LONGMEMEVAL represents a significant step forward in evaluating and improving long-term memory capabilities for chat assistants. The research demonstrates that current systems still face substantial challenges in maintaining effective long-term memory, even with advanced retrieval and generation techniques. [...] Recent large language model (LLM)-driven chat assistant systems have integrated memory components to track user-assistant chat histories, enabling more accurate and personalized responses. However, their long-term memory capabilities in sustained interactions remain underexplored. This paper introduces LongMemEval, a comprehensive benchmark designed to evaluate five core long-term memory abilities of chat assistants: information extraction, multi-session reasoning, temporal reasoning, knowledge

Source: [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory | alphaXiv](https://www.alphaxiv.org/abs/2410.10813v1)

### 2. GitHub - xiaowu0162/LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory (ICLR 2025) · GitHub

- URL: <https://github.com/xiaowu0162/longmemeval>
- Score: 0.882276

```
@article{wu2024longmemeval, title={LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory}, author={Di Wu and Hongwei Wang and Wenhao Yu and Yuwei Zhang and Kai-Wei Chang and Dong Yu}, year={2024}, eprint={2410.10813}, archivePrefix={arXiv}, primaryClass={cs.CL}, url={ } 
```

## About

Benchmarking Chat Assistants on Long-Term Interactive Memory (ICLR 2025)

### Resources

Readme

MIT license

Activity

### Stars

1.1k stars

### Watchers

9 watching

### Forks [...] LongMemEval supports compiling a chat history of arbitrary length for a question instance, so that you can easily scale up the difficulty over `LongMemEval_M`.

### Downloading the Corpus

Please download the compressed data from this link and uncompress the data under `data/custom_history`. The released data contains three parts: [...] `haystack_sessions`: a list of the actual contents of the user-assistant chat history sessions. Each session is a list of turns. Each turn is a direct with the format `{"role": user/assistant, "content": message content}`. For the turns that contain the required evidence, an additional field `has_answer: true` is provided. This label is used for turn-level memory recall accuracy evaluation.

Source: [GitHub - xiaowu0162/LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory (ICLR 2025) · GitHub](https://github.com/xiaowu0162/longmemeval)
