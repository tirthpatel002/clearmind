---
question: "What is Aleksandr Patrushev's public GitHub profile and notable public repositories?"
query: "\"Aleksandr Patrushev\" Nebius Head of Product Management, ML/AI"
fetchedAt: "2026-10-30T14:35:11.018Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 2
match: uncertain
fallbackQuery: "\"Aleksandr Patrushev\" ML/AI"
group: judges
subject: "Aleksandr Patrushev"
subjectRole: "Head of Product Management, ML/AI, Nebius"
visibleTo: ["judge-aleksandr-patrushev"]
mock: false
sources:
  - "https://github.com/nebius/ml-cookbook/tree/main/skypilot"
  - "https://github.com/patrick-239"
  - "https://github.com/nebius/nebius-ps-services"
  - "https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md"
  - "https://github.com/orgs/nebius/repositories"
  - "https://github.com/gabrifc/Udacity-Data-Analyst-Nanodegree/blob/master/P6%20-%20Data%20Visualization/data/tidyDataset.tsv"
  - "https://github.com/lintool/Ivory/blob/master/data/vocab/vocab.en-fr.fr"
---
# What is Aleksandr Patrushev's public GitHub profile and notable public repositories?


Query: `"Aleksandr Patrushev" Nebius Head of Product Management, ML/AI` (Tavily basic search, fetched 2026-10-30T14:35:11.018Z)

Fallback query (first pass had no clear name+company match): `"Aleksandr Patrushev" ML/AI`

> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.


## Answer

The sources do not provide information about Aleksandr Patrushev's current role as Head of Product Management, ML/AI. However, they do mention his GitHub username, patrick-239, and list some of his repositories, including aws-deepracer-workshops and Fine-Tuning-LLM-on-Amazon-SM. Additionally, the sources describe the integration of SkyPilot with Nebius AI Cloud and provide details about various AI/ML deployment building blocks and applications available on GitHub under the nebius organization.

## Results (7)

### 1. ml-cookbook/skypilot at main · nebius/ml-cookbook · GitHub

- URL: <https://github.com/nebius/ml-cookbook/tree/main/skypilot>
- Score: 0.35421017

Title: ml-cookbook/skypilot at main · nebius/ml-cookbook · GitHub
## Navigation Menu. # skypilot. ## Directory actions. ## Latest commit. # skypilot. | Name | | Name | Last commit message | Last commit date |. SkyPilot is an open-source framework for running AI and batch workloads. Nebius AI Cloud offers seamless integration with SkyPilot, simplifying the process of launching and managing distributed AI workloads on powerful GPU instances. ## Running SkyPilot Jobs on Nebius AI Cloud. Once you have your access token and project ID configured, SkyPilot can launch and manage clusters on Nebius. Be sure to check your Nebius quotas and request increases if you are launching GPU-intensive tasks for the first time. The `examples` directory contains several YAML configurations that demonstrate different SkyPilot capabilities on Nebius AI Cloud:. ### Basic Job. Run a simple job to verify GPU access:. This example launches a single node with 8 H100 GPUs and runs `nvidia-smi` to verify GPU access. Run a job that mounts Nebius Object Storage to filesystem:. Run a distributed data migration job from AWS S3 to Nebius Object Storage:. This example launches a distributed data migration task across multiple nodes:. ### AI Training. Run a single-node AI training job using PyTorch:. This example trains a GPT-like model (based on minGPT) on a single node with 8 H100 GPUs. ### Distributed Training. Run a multi-node distributed training job:. This example distributes the same minGPT training across 2 nodes, each with 8 H100 GPUs, using PyTorch's Distributed Data Parallel (DDP). This example launches 2 nodes and tests the Infiniband bandwidth between them using the `ib_send_bw` utility. ### Llama 4 Inference with SGLang. Run Llama 4 inference server using SGLang:. Note: You may need to request access to the `meta-llama/Llama-4-Scout-17B-16E-Instruct` model on HuggingFace. `meta-llama/Llama-4-Scout-17B-16E-Instruct`. This example launches a Llama 4 inference server:. After launching, you can send requests to the inference API:. Run async multi-turn GRPO (Group Relative Policy Optimization) training using the VERL framework:. If you switch between Service Accounts using the `nebius-setup.sh`, you might see errors when provisioning new clusters. That could be because the SkyPilot API server has cached old credentials. You can fix this by running `sky api stop; sky api start` and then retrying. ## Footer.

Source: [ml-cookbook/skypilot at main · nebius/ml-cookbook · GitHub](https://github.com/nebius/ml-cookbook/tree/main/skypilot)

### 2. patrick-239 (Aleksandr Patrushev) · GitHub

- URL: <https://github.com/patrick-239>
- Score: 0.33535138

Title: patrick-239 (Aleksandr Patrushev) · GitHub
## Navigation Menu. # Search code, repositories, users, issues, pull requests... You signed in with another tab or window. Reload to refresh your session. You switched accounts on another tab or window. @patrick-239   **patrick-239**   Follow. View patrick-239's full-sized avatar. # Aleksandr Patrushev patrick-239. ## Achievements. Achievement: Pair ExtraordinaireAchievement: Pull Shark. ## Popular repositories Loading. 1. aws-deepracer-workshops  aws-deepracer-workshops  Public. Forked from aws-solutions-library-samples/guidance-for-training-an-aws-deepracer-model-using-amazon-sagemaker. 2. Fine-Tuning-LLM-on-Amazon-SM  Fine-Tuning-LLM-on-Amazon-SM  Public. 3. amazon-fraud-detector-bot-detection-demo  amazon-fraud-detector-bot-detection-demo  Public. Forked from aws-samples/amazon-fraud-detector-bot-detection-demo. 4. retail-demo-store  retail-demo-store  Public. Forked from aws-samples/retail-demo-store. AWS Retail Demo Store is a sample retail web application and workshop platform demonstrating how AWS infrastructure and services can be used to build compelling customer experiences for eCommerce, …. 5. amazon-lookout-for-metrics-samples  amazon-lookout-for-metrics-samples  Public. Forked from aws-samples/amazon-lookout-for-metrics-samples. 6. amazon-forecast-samples  amazon-forecast-samples  Public. Forked from aws-samples/amazon-forecast-samples. Notebooks and examples on how to onboard and use various features of Amazon Forecast. Something went wrong, please refresh the page to try again. If the problem persists, check the GitHub status page or contact support. ### Uh oh! There was an error while loading. You can’t perform that action at this time.

Source: [patrick-239 (Aleksandr Patrushev) · GitHub](https://github.com/patrick-239)

### 3. GitHub - nebius/nebius-ps-services: Nebius Platform Services: reusable AI/ML deployment building blocks for Nebius AI Cloud · GitHub

- URL: <https://github.com/nebius/nebius-ps-services>
- Score: 0.32962957

| .gitignore | .gitignore |  |  |
| .markdownlint.json | .markdownlint.json |  |  |
| .nojekyll | .nojekyll |  |  |
| CHANGELOG.md | CHANGELOG.md |  |  |
| LICENSE | LICENSE |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
| index.html | index.html |  |  |
|  | [...] | Name | Name | Last commit message | Last commit date |
 ---  --- |
| .agents/plugins | .agents/plugins |  |  |
| .claude-plugin | .claude-plugin |  |  |
| .github | .github |  |  |
| courses | courses |  |  |
| docs | docs |  |  |
| examples | examples |  |  |
| helm-charts | helm-charts |  |  |
| misc/github-report | misc/github-report |  |  |
| platform-infra | platform-infra |  |  |
| services | services |  |  |
| skills | skills |  |  |
| .gitattributes | .gitattributes |  |  | [...] ## Repository Website

Source: [GitHub - nebius/nebius-ps-services: Nebius Platform Services: reusable AI/ML deployment building blocks for Nebius AI Cloud · GitHub](https://github.com/nebius/nebius-ps-services)

### 4. nebius-k8s-applications/weaviate/README.md at main · nebius/nebius-k8s-applications · GitHub

- URL: <https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md>
- Score: 0.3089721

Weaviate is a platform that provides the advantages of both vector and keyword search right out of the box. It allows to store and retrieve data objects and vector embeddings, improves semantic understanding and accuracy. Weaviate has pre-built modules for popular ML models and frameworks, enabling faster development and iteration. At the same time, it is possible to connect to your favorite ML models to build intuitive, reliable AI applications that scale. Weaviate has an active community that [...] community that helps developers of all levels build end-to-end AI applications. [...] Nebius AI does not provide technical support for the product. If you have any issues, please refer to the developer’s information resources.

 Weaviate website
 Weaviate documentation
 Weaviate on GitHub

## Term of service

 Terms of Use of Nebius Applications
 BSD-3

You can’t perform that action at this time.

Source: [nebius-k8s-applications/weaviate/README.md at main · nebius/nebius-k8s-applications · GitHub](https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md)

### 5. nebius repositories · GitHub

- URL: <https://github.com/orgs/nebius/repositories>
- Score: 0.23251961

Skip to content   
 
 

## Navigation Menu

Sign in

Appearance settings

Sign in

Sign up

Appearance settings

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

{{ message }}

# @nebius Nebius

 

# All

Search

## Repositories list

## 51 repositories [...] •2222 forks in nebius/nebius-physical-ai•7676 stars in nebius/nebius-physical-ai•1010 issues in nebius/nebius-physical-ai•2828 pull requests in nebius/nebius-physical-ai•Updated Oct 27, 2026Oct 27, 2026
 ### nebius-ps-services

  Publicnebius/nebius-ps-services’s past year of commit activity

  Nebius Platform Services: reusable AI/ML deployment building blocks for Nebius AI Cloud

  pythonbashterraform

  pythonbashterraformhelm

  Python

  •

  Apache License 2.0 [...] ProTip! When viewing an organization's repositories, you can use the `props.` filter to filter by custom property.

You can’t perform that action at this time.

Source: [nebius repositories · GitHub](https://github.com/orgs/nebius/repositories)

### 6. Udacity-Data-Analyst-Nanodegree/P6 - Data Visualization/data/tidyDataset.tsv at master · gabrifc/Udacity-Data-Analyst-Nanodegree · GitHub

- URL: <https://github.com/gabrifc/Udacity-Data-Analyst-Nanodegree/blob/master/P6%20-%20Data%20Visualization/data/tidyDataset.tsv>
- Score: 0.034766078

Skip to content   
 
 

## Navigation Menu

Sign in

Sign in

Sign up

Appearance settings

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

{{ message }}

## Repository navigation

 

## Expand file tree

/

# tidyDataset.tsv

Copy path

More file actions

More file actions [...] More file actions

We can't make this file beautiful and searchable because it's too large.

## Latest commit

## History

History

History

3889 lines (3889 loc) · 899 KB

/

# tidyDataset.tsv

Copy path

## File metadata and controls

3889 lines (3889 loc) · 899 KB

Copy raw file

Download raw file

Open symbols panel

Edit and raw actions

You can’t perform that action at this time.

Source: [Udacity-Data-Analyst-Nanodegree/P6 - Data Visualization/data/tidyDataset.tsv at master · gabrifc/Udacity-Data-Analyst-Nanodegree · GitHub](https://github.com/gabrifc/Udacity-Data-Analyst-Nanodegree/blob/master/P6%20-%20Data%20Visualization/data/tidyDataset.tsv)

### 7. Ivory/data/vocab/vocab.en-fr.fr at master · lintool/Ivory · GitHub

- URL: <https://github.com/lintool/Ivory/blob/master/data/vocab/vocab.en-fr.fr>
- Score: 0.022683308

Skip to content   
 
 

## Navigation Menu

Sign in

Appearance settings

Sign in

Sign up

Appearance settings

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

{{ message }}

This repository was archived by the owner on May 6, 2018. It is now read-only.

## Repository navigation

 

## Expand file tree [...] /

# vocab.en-fr.fr

Copy path

More file actions

More file actions

## Latest commit

## History

History

History

executable file

·

7622 lines (7622 loc) · 659 KB

/

# vocab.en-fr.fr

Copy path

## File metadata and controls

executable file

·

7622 lines (7622 loc) · 659 KB

Copy raw file

Download raw file

Open symbols panel

Edit and raw actions

You can’t perform that action at this time.

Source: [Ivory/data/vocab/vocab.en-fr.fr at master · lintool/Ivory · GitHub](https://github.com/lintool/Ivory/blob/master/data/vocab/vocab.en-fr.fr)
