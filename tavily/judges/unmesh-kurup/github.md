---
question: "What is Unmesh Kurup's public GitHub profile and notable public repositories?"
query: "\"Unmesh Kurup\" Nebius Chief ML Researcher, Product"
fetchedAt: "2026-10-30T14:35:45.021Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 2
match: uncertain
fallbackQuery: "\"Unmesh Kurup\" ML Researcher"
group: judges
subject: "Unmesh Kurup"
subjectRole: "Chief ML Researcher, Product, Nebius"
visibleTo: ["judge-unmesh-kurup"]
mock: false
sources:
  - "https://github.com/nebius/ml-cookbook"
  - "https://github.com/nebius/ml-cookbook/tree/main/slurm/object-storage-checkpointing"
  - "https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md"
  - "https://github.com/orgs/nebius/repositories"
  - "https://github.com/nebius/nebius-ps-services"
  - "https://github.com/GoodyIT/naukri-job-profile-scraper/blob/master/resdex_20190823.csv"
  - "https://github.com/nikolajanjic/portfolios2021"
  - "https://gist.github.com/jasonmimick/9627bf182a57a99d69721418b0f950a4"
---
# What is Unmesh Kurup's public GitHub profile and notable public repositories?


Query: `"Unmesh Kurup" Nebius Chief ML Researcher, Product` (Tavily basic search, fetched 2026-10-30T14:35:45.021Z)

Fallback query (first pass had no clear name+company match): `"Unmesh Kurup" ML Researcher`

> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.


## Answer

The provided sources do not mention Unmesh Kurup or his role as Chief ML Researcher, Product. The sources focus on repositories related to Nebius, including the ML Cookbook, Kubernetes applications, and platform services, detailing their functionalities and licensing information. There is no information about an individual named Unmesh Kurup in these repositories.

## Results (8)

### 1. GitHub - nebius/ml-cookbook · GitHub

- URL: <https://github.com/nebius/ml-cookbook>
- Score: 0.2732523

+ Use `slurm/object-storage-checkpointing/`

## License

Copyright 2025 Nebius B.V. [...] ## Repository files navigation

# ML Cookbook 🍳

Welcome to the ML Cookbook repository! This is your one-stop guide for common use cases in training and inference of machine learning models on the Nebius.ai cloud platform. Whether you're a seasoned data scientist or just starting your ML journey, this repository provides practical examples, best practices, and ready-to-use code snippets to help you get the most out of your ML workflows.

## Start Here [...] ## 🚀 What's Inside?

This repository is organized into recipes that cover a variety of ML tasks, leveraging popular tools and technologies such as:

 Kubernetes (K8s): Scalable and efficient orchestration of ML workloads.
 NVIDIA GPUs: Accelerate training and inference with CUDA-enabled hardware.
 Linux: Optimized environments for ML development.
 Open Source Tools: Leverage the power of open-source libraries and frameworks.

Each recipe includes:

Source: [GitHub - nebius/ml-cookbook · GitHub](https://github.com/nebius/ml-cookbook)

### 2. ml-cookbook/slurm/object-storage-checkpointing at main · nebius/ml-cookbook · GitHub

- URL: <https://github.com/nebius/ml-cookbook/tree/main/slurm/object-storage-checkpointing>
- Score: 0.23129326

Title: ml-cookbook/slurm/object-storage-checkpointing at main · nebius/ml-cookbook · GitHub
You signed in with another tab or window. You switched accounts on another tab or window. # object-storage-checkpointing. # Running PyTorch training with persistent Object Storage checkpoints on Slurm (Soperator). Use this recipe when training checkpoints are filling the shared Soperator jail, or when a job interruption would otherwise lose hours of progress. Every rank writes its checkpoint shard directly to Nebius Object Storage: checkpoint data does not stage in, or consume capacity from, the jail. After an interruption, the job reads one small `latest` marker and resumes from the newest complete checkpoint. A hard kill during an upload cannot replace that marker with an incomplete checkpoint. | Checkpoints are too large for the shared jail | Shards are uploaded directly to Object Storage; no checkpoint directory is created in the jail |. | Slurm requeues the job after a node interruption | The same job ID resumes automatically from its latest complete checkpoint |. | You stop and resubmit a job | Pass the old prefix and resume from the same checkpoint |. | A rank is killed during an upload | The previous committed checkpoint remains safe and resumable |. | A cluster is replaced | An operator can attach the old bucket and the researcher can reuse the prefix |. The reusable part is the FSDP2 and PyTorch Distributed Checkpoint (DCP) pattern: asynchronous sharded uploads, an atomic commit marker, retention, consistent failure handling across ranks, and signal-safe shutdown. It does not contain checkpoint data, and receiving one does not by itself mean that Slurm will restart the job. This recipe asks Slurm to send it before the job time limit and interprets it as "finish the current safe step, commit a checkpoint, and exit.". Slurm uses it when a job reaches its time limit or is cancelled. The trainer does not need a handler for it. | Job approaches its Slurm time limit | Because the job requests `--signal=USR1@120`, Slurm signals all job steps approximately 120 seconds before the limit. | Treat `SIGUSR1` or `SIGTERM` as a request to stop collectively at the next safe step, drain any upload, and commit the current step.

Source: [ml-cookbook/slurm/object-storage-checkpointing at main · nebius/ml-cookbook · GitHub](https://github.com/nebius/ml-cookbook/tree/main/slurm/object-storage-checkpointing)

### 3. nebius-k8s-applications/weaviate/README.md at main · nebius/nebius-k8s-applications · GitHub

- URL: <https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md>
- Score: 0.20131063

Weaviate is a platform that provides the advantages of both vector and keyword search right out of the box. It allows to store and retrieve data objects and vector embeddings, improves semantic understanding and accuracy. Weaviate has pre-built modules for popular ML models and frameworks, enabling faster development and iteration. At the same time, it is possible to connect to your favorite ML models to build intuitive, reliable AI applications that scale. Weaviate has an active community that [...] 1. Create a Kubernetes cluster and a node group in it. Each node in the group should have at least 8 GB of RAM.
2. install kubectl, and configure it to work with the created cluster.

To install the product:

1. On the cluster page in the management console, go to the Marketplace tab, select the product, and click Install.
2. Configure the application: [...] community that helps developers of all levels build end-to-end AI applications.

Source: [nebius-k8s-applications/weaviate/README.md at main · nebius/nebius-k8s-applications · GitHub](https://github.com/nebius/nebius-k8s-applications/blob/main/weaviate/README.md)

### 4. nebius repositories · GitHub

- URL: <https://github.com/orgs/nebius/repositories>
- Score: 0.18795142

•6464 forks in nebius/soperator•454454 stars in nebius/soperator•1717 issues in nebius/soperator•2323 pull requests in nebius/soperator•Updated Oct 26, 2026Oct 26, 2026
 ### contree-client

  Publicnebius/contree-client’s past year of commit activity

  Python

  •

  Apache License 2.0

  •11 fork in nebius/contree-client•22 stars in nebius/contree-client•00 issues in nebius/contree-client•00 pull requests in nebius/contree-client•Updated Oct 26, 2026Oct 26, 2026
 ### ml-containers [...] Shell

  •

  Apache License 2.0

  •00 forks in nebius/skills•88 stars in nebius/skills•00 issues in nebius/skills•00 pull requests in nebius/skills•Updated Oct 26, 2026Oct 26, 2026
 ### ml-cookbook

  Publicnebius/ml-cookbook’s past year of commit activity

  Shell

  •

  Apache License 2.0

  •99 forks in nebius/ml-cookbook•1919 stars in nebius/ml-cookbook•00 issues in nebius/ml-cookbook•66 pull requests in nebius/ml-cookbook•Updated Oct 26, 2026Oct 26, 2026
 ### packer-plugin-nebius [...] Skip to content   
 
 

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

## 51 repositories

Source: [nebius repositories · GitHub](https://github.com/orgs/nebius/repositories)

### 5. GitHub - nebius/nebius-ps-services: Nebius Platform Services: reusable AI/ML deployment building blocks for Nebius AI Cloud · GitHub

- URL: <https://github.com/nebius/nebius-ps-services>
- Score: 0.17981876

| .gitignore | .gitignore |  |  |
| .markdownlint.json | .markdownlint.json |  |  |
| .nojekyll | .nojekyll |  |  |
| CHANGELOG.md | CHANGELOG.md |  |  |
| LICENSE | LICENSE |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
| index.html | index.html |  |  |
|  | [...] ## Repository Website [...] Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.

You may obtain a copy of the License at . Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

## About

Source: [GitHub - nebius/nebius-ps-services: Nebius Platform Services: reusable AI/ML deployment building blocks for Nebius AI Cloud · GitHub](https://github.com/nebius/nebius-ps-services)

### 6. naukri-job-profile-scraper/resdex_20190823.csv at master · GoodyIT/naukri-job-profile-scraper

- URL: <https://github.com/GoodyIT/naukri-job-profile-scraper/blob/master/resdex_20190823.csv>
- Score: 0.04600399

| 164 | Mrinalini Sharma | 11yr 0m | 16.0 Lacs | Hyderabad | Senior Consultant -AI Researcher | Infosys Limited | Bangalore, Delhi/NCR, Hyderabad | Senior Consultant,Analytics Manager,Data Analysis,Data Science,Artificial, ,Intelligence,Machine Learning,Deep Learning,Natural Language Processing,Statistical Data Modelling,Predictive Modelling,Business Consulting,Oracle EBS,Oracle Fusion, Oracle E-Business Suite | [...] | 233 | Patta Suresh | 6yr 0m | 8.0 Lacs | Hyderabad | AI ML Data Scientist | AVEVA Information Technology India Pvt. Ltd. | Hyderabad, Secunderabad | machine learning,deep learning,artificial, ,intelligence,natural language processing,nlp,text mining,predictive analytics,data analytics,big data analytics,regression,linear regression,cluster analysis,time series analy,Computer Vision, LOGISTICS, Neural networks | [...] | 185 | Mayank Chaudhary | 2yr 6m | 0.0 Lacs | Hyderabad | Data Scientist, Machine Learning Engineer | Bridge International Academies | Delhi/NCR, Gurgaon, Hyderabad | natural language processing,data science,machine learning,machine,learning,nlp,python,pandas,ml pandas,neural networks,statistics,modeling,data analysis,data scientist,sklearn,computer science,Artificial, ,Intelligence,Data Analytics,Deep Learning,ml |

Source: [naukri-job-profile-scraper/resdex_20190823.csv at master · GoodyIT/naukri-job-profile-scraper](https://github.com/GoodyIT/naukri-job-profile-scraper/blob/master/resdex_20190823.csv)

### 7. GitHub - nikolajanjic/portfolios2025: A list of developer portfolios for your inspiration · GitHub

- URL: <https://github.com/nikolajanjic/portfolios2021>
- Score: 0.020553375

## E

## F

## G

## H

## I

## J

## K

## L

## M

## N

## O

## P

## Q

## R

## S

## T

## U

## V

## W

## Y

## Z

## About

A list of developer portfolios for your inspiration

### Resources

### Contributing

### Stars

### Watchers

### Forks

## Releases

## Packages

## Contributors

## Languages

## Footer

### Footer navigation [...] Have you built a portfolio? Are you proud of it?! Open a PR to this repo and let's showcase your work! Refer to the CONTRIBUTING file for direction.

This repo was inspired by Ali Spittel's tweet
Portfolio

Portfolio

Hopefully this repo can serve as a source of inspiration for your portfolio!

## Current Portfolio Count: 1029

Jump to: A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | Y | Z | Random Portfolio

## A

## B

## C

## D

## E

## F

## G [...] ## Navigation Menu

## Latest commit

## History

## Folders and files

| Name | | Name | Last commit message | Last commit date |
 ---  --- 
| .github | | .github |  |  |
| src | | src |  |  |
| .gitignore | | .gitignore |  |  |
| .lycheeignore | | .lycheeignore |  |  |
| CONTRIBUTING.md | | CONTRIBUTING.md |  |  |
| README.md | | README.md |  |  |
| View all files | | |

## Repository files navigation

# Developer Portfolios

A list of developer portfolios for your inspiration

Source: [GitHub - nikolajanjic/portfolios2025: A list of developer portfolios for your inspiration · GitHub](https://github.com/nikolajanjic/portfolios2021)

### 8. netflix.csv · GitHub

- URL: <https://gist.github.com/jasonmimick/9627bf182a57a99d69721418b0f950a4>
- Score: 0.015272569

|  | 80994416,Movie,Aadu 2,Midhun Manuel Thomas,"Jayasurya, Vinayakan, Sunny Wayne, Vijay Babu, Saiju Kurup, Vineeth Mohan, Unni Rajan P. Dev, Dharmajan Bolgatty, Indrans",India,"May 15, 2018",2017,TV-14,150 min,"Comedies, International Movies","When Shaji Pappan and his gang of goofy outlaws find themselves low on funds, they plan to once again win a hefty prize in a tug-of-war competition." | [...] |  | 81011973,Movie,Naa Bangaaru Talli,Rajesh Touchriver,"Siddique, Anjali Patil, Lakshmi Menon, Nina Kurup, Rathna Shekar Reddy, Anoop Aravindan",India,"October 19, 2018",2013,TV-MA,122 min,"Dramas, International Movies","A father leading a dark double life and his daughter, who's eager to pursue her studies in Hyderabad, face the tragic consequences of sex trafficking." | [...] |  | 81018234,Movie,​Goli Soda 2,Vijay Milton,"Samuthirakani, Bharath Seeni, Vinoth, Esakki Barath, Chemban Vinod Jose, Gautham Menon, Krisha Kurup, Subiksha",India,"September 15, 2018",2018,TV-MA,128 min,"Action & Adventure, Dramas, International Movies","A taxi driver, a gangster and an athlete struggle to better their lives despite obstacles like crooked politicians, evil dons and caste barriers." |

Source: [netflix.csv · GitHub](https://gist.github.com/jasonmimick/9627bf182a57a99d69721418b0f950a4)
