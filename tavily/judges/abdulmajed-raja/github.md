---
question: "What is AbdulMajed Raja's public GitHub profile and notable public repositories?"
query: "\"AbdulMajed Raja\" Nebius Developer Relations Lead (Token Factory) - APJ"
fetchedAt: "2026-10-30T14:30:05.634Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 2
match: uncertain
fallbackQuery: "\"AbdulMajed Raja\" Token Factory Developer Relations APJ"
group: judges
subject: "AbdulMajed Raja"
subjectRole: "Developer Relations Lead (Token Factory) - APJ, Nebius"
visibleTo: ["judge-abdulmajed-raja"]
mock: false
sources:
  - "https://github.com/nebius/token-factory-cookbook/blob/main/workshops/token-factory-workshop/README.md"
  - "https://github.com/nebius/token-factory-cookbook/tree/main/workshops/token-factory-workshop"
  - "https://github.com/nebius/token-factory-cookbook/tree/main/integrations/openclaw"
  - "https://github.com/nebius/token-factory-cookbook"
  - "https://github.com/nebius/token-factory-cookbook/tree/main"
  - "https://github.com/adilmukhtar82/Transliteration-Roman-to-Urdu-monolingual-corpora/blob/master/Deep%20learning%20model%20Language%20for%20words%20pruning%20-%20Roman%20Urdu.ipynb"
---
# What is AbdulMajed Raja's public GitHub profile and notable public repositories?


Query: `"AbdulMajed Raja" Nebius Developer Relations Lead (Token Factory) - APJ` (Tavily basic search, fetched 2026-10-30T14:30:05.634Z)

Fallback query (first pass had no clear name+company match): `"AbdulMajed Raja" Token Factory Developer Relations APJ`

> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.


## Answer

AbdulMajed Raja Nebius is identified as the Developer Relations Lead for Token Factory, which is involved in building production-grade AI applications through a production feedback loop. Token Factory provides a complete workflow for this process, including starting with base models, collecting production logs, fine-tuning or shaping models using real production data, and deploying and monitoring the improved models. The sources do not provide specific details about AbdulMajed Raja Nebius's role beyond his title.

## Results (6)

### 1. token-factory-cookbook/workshops/token-factory-workshop/README.md at main · nebius/token-factory-cookbook · GitHub

- URL: <https://github.com/nebius/token-factory-cookbook/blob/main/workshops/token-factory-workshop/README.md>
- Score: 0.36351183

## Workshop Theme

### Building Production-Grade AI Applications

 `` 

Modern AI applications improve continuously through a production feedback loop:

1. Start with base (stock) models
2. Collect production logs from real usage
3. Fine-tune or shape models using real production data
4. Deploy the improved model

This iterative process enables teams to progressively build robust, production-ready AI systems.

⭐️ Token Factory has the complete workflow built-in ⭐️

## 0 — Getting Started [...] ➡️ Collecting Production Logs

## 3 - Customizing / Shaping Models

Learn how to adapt models for our specific use cases.

➡️ fine tuning models - improve model performance by training on production data and other optimizations.

➡️ Distilling models - create smaller, efficient models.

## 4 - Deploy and Monitor

Deploy trained models and monitor their performance in real time.

dedicated end points

## 5 - Integration with Coding Agents [...] Begin by setting up your environment and verifying access.

➡️ Getting Started Guide

## 1 - Using Models

In this section, we explore how to use models hosted on Token Factory.

➡️ explore Token Factory UI

➡️ structured-output: Produce structured output like JSON from LLMs.

➡️ tool calling: Extend LLMs capability by providing them with functions/tools.

➡️ search agent with Tavily

## 2 - Collecting Production Logs

Next, we capture real-world usage data to improve model performance.

Source: [token-factory-cookbook/workshops/token-factory-workshop/README.md at main · nebius/token-factory-cookbook · GitHub](https://github.com/nebius/token-factory-cookbook/blob/main/workshops/token-factory-workshop/README.md)

### 2. token-factory-cookbook/workshops/token-factory-workshop at main · nebius/token-factory-cookbook · GitHub

- URL: <https://github.com/nebius/token-factory-cookbook/tree/main/workshops/token-factory-workshop>
- Score: 0.35226917

This iterative process enables teams to progressively build robust, production-ready AI systems.

⭐️ Token Factory has the complete workflow built-in ⭐️

## 0 — Getting Started

Begin by setting up your environment and verifying access.

➡️ Getting Started Guide

## 1 - Using Models

In this section, we explore how to use models hosted on Token Factory.

➡️ explore Token Factory UI

➡️ structured-output: Produce structured output like JSON from LLMs. [...] A Nebius Token Factory account
 (optinal) 🎁 credits. Use this link - activation code will be provided at the event

## Workshop Theme

### Building Production-Grade AI Applications

 `` 

Modern AI applications improve continuously through a production feedback loop:

1. Start with base (stock) models
2. Collect production logs from real usage
3. Fine-tune or shape models using real production data
4. Deploy the improved model [...] | Name | Name | Last commit message | Last commit date |
 ---  --- |
| parent directory .. |
| data | data |  |  |
| images | images |  |  |
| .python-version | .python-version |  |  |
| README.md | README.md |  |  |
| collecting-production-logs.md | collecting-production-logs.md |  |  |
| dedicated-endpoints.md | dedicated-endpoints.md |  |  |
| distillation.md | distillation.md |  |  |
| explore-token-factory.md | explore-token-factory.md |  |  |
| fine-tuning.md | fine-tuning.md |  |  |

Source: [token-factory-cookbook/workshops/token-factory-workshop at main · nebius/token-factory-cookbook · GitHub](https://github.com/nebius/token-factory-cookbook/tree/main/workshops/token-factory-workshop)

### 3. token-factory-cookbook/integrations/openclaw at main · nebius/token-factory-cookbook · GitHub

- URL: <https://github.com/nebius/token-factory-cookbook/tree/main/integrations/openclaw>
- Score: 0.3362008

## Prerequisites

 A working OpenClaw installation
 A Token Factory account and API key; see Getting Started
 A model available to your Token Factory account

## 1. Keep the API key out of configuration

Export the key in the environment that starts the OpenClaw gateway:

```
export"your-token-factory-api-key" " "
``` [...] More options

## Directory actions

## More options

More options

## Latest commit

## History

History

History

/

# openclaw

/

Copy path

## Folders and files

| Name | Name | Last commit message | Last commit date |
 ---  --- |
| parent directory .. |
| .env.example | .env.example |  |  |
| README.md | README.md |  |  |
| openclaw.example.json | openclaw.example.json |  |  |
| test\_recipe.py | test\_recipe.py |  |  |
|  |

## README.md

Outline

# OpenClaw + Nebius Token Factory [...] ## Offline validation for contributors

From the repository root:

```
python -m unittest integrations.openclaw.test_recipe
```

The test checks the JSON example, canonical endpoint, environment-backed secret reference, provider/model IDs, lifecycle note, and common secret/configuration regressions. It does not require an API key or network access.

 OpenClaw custom providers
 OpenClaw models CLI
 Token Factory documentation
 Token Factory public model catalog
 Cookbook Getting Started

Source: [token-factory-cookbook/integrations/openclaw at main · nebius/token-factory-cookbook · GitHub](https://github.com/nebius/token-factory-cookbook/tree/main/integrations/openclaw)

### 4. GitHub - nebius/token-factory-cookbook · GitHub

- URL: <https://github.com/nebius/token-factory-cookbook>
- Score: 0.3154201

| models | models |  |  |
| office-hours | office-hours |  |  |
| post-training | post-training |  |  |
| rag | rag |  |  |
| start-here | start-here |  |  |
| tool-calling | tool-calling |  |  |
| workshops | workshops |  |  |
| .gitignore | .gitignore |  |  |
| AddLora.ipynb | AddLora.ipynb |  |  |
| LICENSE | LICENSE |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
| batch.ipynb | batch.ipynb |  |  |
| env\_sample.txt | env\_sample.txt |  |  | [...] | Name | Name | Last commit message | Last commit date |
 ---  --- |
| .github | .github |  |  |
| agents | agents |  |  |
| api | api |  |  |
| apps | apps |  |  |
| articles | articles |  |  |
| coding | coding |  |  |
| community | community |  |  |
| data | data |  |  |
| distillation | distillation |  |  |
| evaluations/inspect-ai | evaluations/inspect-ai |  |  |
| fun | fun |  |  |
| images | images |  |  |
| integrations | integrations |  |  |
| lora/lora-1 | lora/lora-1 |  |  | [...] ## ⛓️ Integrations

Guides for connecting third-party tools to Token Factory:

 OpenClaw — self-hosted AI agents on open models
 Tavily — LLM-optimized search API for agentic research
 Pixeltable — multimodal AI data infrastructure with native Token Factory chat + embeddings
 OpenEnv prompt optimization — build an OpenEnv agent environment and optimize an agent's prompt against its reward with open models

See also the official catalog: docs.tokenfactory.nebius.com/integrations

Source: [GitHub - nebius/token-factory-cookbook · GitHub](https://github.com/nebius/token-factory-cookbook)

### 5. GitHub - nebius/token-factory-cookbook · GitHub

- URL: <https://github.com/nebius/token-factory-cookbook/tree/main>
- Score: 0.3154201

| models | models |  |  |
| office-hours | office-hours |  |  |
| post-training | post-training |  |  |
| rag | rag |  |  |
| start-here | start-here |  |  |
| tool-calling | tool-calling |  |  |
| workshops | workshops |  |  |
| .gitignore | .gitignore |  |  |
| AddLora.ipynb | AddLora.ipynb |  |  |
| LICENSE | LICENSE |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
| batch.ipynb | batch.ipynb |  |  |
| env\_sample.txt | env\_sample.txt |  |  | [...] | Name | Name | Last commit message | Last commit date |
 ---  --- |
| .github | .github |  |  |
| agents | agents |  |  |
| api | api |  |  |
| apps | apps |  |  |
| articles | articles |  |  |
| coding | coding |  |  |
| community | community |  |  |
| data | data |  |  |
| distillation | distillation |  |  |
| evaluations/inspect-ai | evaluations/inspect-ai |  |  |
| fun | fun |  |  |
| images | images |  |  |
| integrations | integrations |  |  |
| lora/lora-1 | lora/lora-1 |  |  | [...] Public

 NotificationsYou must be signed in to change notification settings
 Fork48 (48)
 Star236 (236)You must be signed in to star a repository

## About

No description, website, or topics provided.

### Resources

Readme

MIT license

### Security policy

Security policy

Activity

Custom properties

### Stars

236 stars

### Watchers

11 watching

### Forks

48 forks

Report repository

BranchesTags

Open more actions menu

## Latest commit

## History

331 Commits

331 Commits

Source: [GitHub - nebius/token-factory-cookbook · GitHub](https://github.com/nebius/token-factory-cookbook/tree/main)

### 6. Transliteration-Roman-to-Urdu-monolingual-corpora/Deep learning model Language for words pruning - Roman Urdu.ipynb at master · adilmukhtar82/Transliteration-Roman-to-Urdu-monolingual-corpora

- URL: <https://github.com/adilmukhtar82/Transliteration-Roman-to-Urdu-monolingual-corpora/blob/master/Deep%20learning%20model%20Language%20for%20words%20pruning%20-%20Roman%20Urdu.ipynb>
- Score: 0.014382674

Skip to content

## Navigation Menu

forward slash/

       Deep learning model Language for words pruning - Roman Urdu.ipynb  
       Roman Urdu DataSet.csv  
       Rule based translation - Urdu to RomUrdu.ipynb  
       huroof mapping to english chars copy.txt  
       huroof mapping to english chars.txt  

## Breadcrumbs

1.   Transliteration-Roman-to-Urdu-monolingual-corpora

/
# Deep learning model Language for words pruning - Roman Urdu.ipynb

Copy path

Blame More file actions [...] Download raw file

Edit and raw actions

Loading Viewer requires iframe.

## Footer

[]( © 2026 GitHub,Inc. 

### Footer navigation

   Terms
   Privacy
   Security
   Status
   Community
   Docs
   Contact
    Manage cookies 
    Do not share my personal information 

 You can’t perform that action at this time. [...] Blame More file actions

## Latest commit

Image 1: adilmukhtar82adilmukhtar82

Add files via upload

May 27, 2019

40b6ce2·May 27, 2019

## History

History

Open commit details

 · 253 KB

## Breadcrumbs

1.   Transliteration-Roman-to-Urdu-monolingual-corpora

/
# Deep learning model Language for words pruning - Roman Urdu.ipynb

Copy path

Top

## File metadata and controls

   Preview 
   Code 
   Blame 

317 lines (317 loc) · 253 KB

Raw

Copy raw file

Download raw file

Source: [Transliteration-Roman-to-Urdu-monolingual-corpora/Deep learning model Language for words pruning - Roman Urdu.ipynb at master · adilmukhtar82/Transliteration-Roman-to-Urdu-monolingual-corpora](https://github.com/adilmukhtar82/Transliteration-Roman-to-Urdu-monolingual-corpora/blob/master/Deep%20learning%20model%20Language%20for%20words%20pruning%20-%20Roman%20Urdu.ipynb)
