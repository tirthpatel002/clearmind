---
question: "What is Evan Helda's public GitHub profile and notable public repositories?"
query: "\"Evan Helda\" Nebius Head of GTM Physical AI"
fetchedAt: "2026-10-30T14:38:43.224Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 2
match: uncertain
fallbackQuery: "\"Evan Helda\" Physical AI GTM"
group: judges
subject: "Evan Helda"
subjectRole: "Head of GTM Physical AI, Nebius"
visibleTo: ["judge-evan-helda"]
mock: false
sources:
  - "https://github.com/nebius/nebius-physical-ai"
  - "https://github.com/nebius/nebius-physical-ai/blob/main/AGENTS.md"
  - "https://github.com/nebius/nebius-physical-ai/blob/main/README.md"
  - "https://github.com/nebius/nebius-physical-ai/tree/main/docs"
  - "https://github.com/nebius/nebius-physical-ai/blob/main/SECURITY.md"
  - "https://github.com/JD-AI-Research-NLP/RevCore/blob/main/word2index_redial2.json"
  - "https://github.com/mrinalpande/conversational_quiz_bot/blob/master/OpenTriviaQA_JSON/literature.json"
  - "https://gist.github.com/damek/c5dcf37e5776128a7470c5708b5779f4"
---
# What is Evan Helda's public GitHub profile and notable public repositories?


Query: `"Evan Helda" Nebius Head of GTM Physical AI` (Tavily basic search, fetched 2026-10-30T14:38:43.224Z)

Fallback query (first pass had no clear name+company match): `"Evan Helda" Physical AI GTM`

> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.


## Answer

The sources indicate that Evan Helda Nebius is associated with the GitHub repository for Nebius Physical AI, which is an agent control plane for Physical AI on Nebius. The repository includes infrastructure setup and management, simulation, robot policy training, synthetic data, and evaluation. The project also involves various tools and workflows for robotics, simulation, perception, and synthetic-data workloads on Nebius infrastructure. The repository's README and other documents detail the requirements and functionalities of the project, including the use of RT-core GPUs and S3 for certain tasks. However, specific roles or titles such as "Head of GTM Physical AI" are not mentioned in the provided sources.

## Results (8)

### 1. GitHub - nebius/nebius-physical-ai: Agent control plane for Physical AI on Nebius: infrastructure setup and management, simulation, robot policy training, synthetic data, and evaluation. · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai>
- Score: 0.42849702

| .cursorignore | .cursorignore |  |  |
| .cursorrules | .cursorrules |  |  |
| .gitattributes | .gitattributes |  |  |
| .gitignore | .gitignore |  |  |
| .gitleaks.toml | .gitleaks.toml |  |  |
| .gitleaksignore | .gitleaksignore |  |  |
| .trivyignore | .trivyignore |  |  |
| AGENTS.md | AGENTS.md |  |  |
| CHANGELOG.md | CHANGELOG.md |  |  |
| CLAUDE.md | CLAUDE.md |  |  |
| CLI.md | CLI.md |  |  |
| CONTRIBUTING.md | CONTRIBUTING.md |  |  |
| DESIGN.md | DESIGN.md |  |  | [...] | Result | Guide | Main requirement |
 --- 
| Generated images or video | Cosmos 3 generation | Compatible GPU and model access |
| Augmented video with evaluation and curation reports | PAIDF + Cosmos 3 | Source video, GPU, S3, hosted inference |
| A labeled video dataset | Physical AI Data Factory | Source video, RT-core GPU, S3 |
| A reconstructed 3D scene and novel views | Neural reconstruction | Sensor capture and RT-core GPU | [...] | Name | Name | Last commit message | Last commit date |
 ---  --- |
| .agents | .agents |  |  |
| .claude | .claude |  |  |
| .github | .github |  |  |
| benchmark | benchmark |  |  |
| deploy/cluster | deploy/cluster |  |  |
| docs | docs |  |  |
| npa | npa |  |  |
| research/lerobot-deploy | research/lerobot-deploy |  |  |
| scripts | scripts |  |  |
| skills | skills |  |  |
| workbench/mlflow | workbench/mlflow |  |  |
| workflows | workflows |  |  |

Source: [GitHub - nebius/nebius-physical-ai: Agent control plane for Physical AI on Nebius: infrastructure setup and management, simulation, robot policy training, synthetic data, and evaluation. · GitHub](https://github.com/nebius/nebius-physical-ai)

### 2. nebius-physical-ai/AGENTS.md at main · nebius/nebius-physical-ai · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai/blob/main/AGENTS.md>
- Score: 0.34900057

## History

History

History

87 lines (78 loc) · 15.3 KB

/

# AGENTS.md

Copy path

## File metadata and controls

87 lines (78 loc) · 15.3 KB

Raw

Copy raw file

Download raw file

Outline

Edit and raw actions

# Nebius Physical AI [...] Nebius Physical AI provides containerized workbench tools and SkyPilot workflows for robotics, simulation, perception, and synthetic-data workloads on Nebius infrastructure. Codex should use this file as a lightweight index, scan `skills/index.yaml`, and load the relevant root `skills/` entry before changing behavior or operations.

## Key Conventions [...] `skills/workflows/neural-reconstruction/SKILL.md`: NuRec/NRE neural reconstruction on Nebius — NCore V4 capture (incl. deriving the `rig → world` pose edge NRE requires) → 3DGUT Gaussian training → renderable USDZ → rig-offset novel views → `reports/sim2real.rrd`. RT-core GPU only (L40S / RTX PRO 6000, never H100/H200).

Source: [nebius-physical-ai/AGENTS.md at main · nebius/nebius-physical-ai · GitHub](https://github.com/nebius/nebius-physical-ai/blob/main/AGENTS.md)

### 3. nebius-physical-ai/README.md at main · nebius/nebius-physical-ai · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai/blob/main/README.md>
- Score: 0.33941197

## History

History

History

341 lines (269 loc) · 17.9 KB

/

# README.md

Copy path

## File metadata and controls

341 lines (269 loc) · 17.9 KB

Raw

Copy raw file

Download raw file

Outline

Edit and raw actions

# Nebius Physical AI

The agent control plane for Physical AI on Nebius. [...] scenario task uses upstream task-space arm drives with robot gravity compensation and 200 Hz physics. Its policy still acts at 50 Hz. Training and held-out artifacts attest this same control profile. [...] | Result | Guide | Main requirement |
 --- 
| Generated images or video | Cosmos 3 generation | Compatible GPU and model access |
| Augmented video with evaluation and curation reports | PAIDF + Cosmos 3 | Source video, GPU, S3, hosted inference |
| A labeled video dataset | Physical AI Data Factory | Source video, RT-core GPU, S3 |
| A reconstructed 3D scene and novel views | Neural reconstruction | Sensor capture and RT-core GPU |

Source: [nebius-physical-ai/README.md at main · nebius/nebius-physical-ai · GitHub](https://github.com/nebius/nebius-physical-ai/blob/main/README.md)

### 4. nebius-physical-ai/docs at main · nebius/nebius-physical-ai · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai/tree/main/docs>
- Score: 0.3333301

| fleet-storage-verification.md | fleet-storage-verification.md |  |  |
| hackathon-cosmos3-reasoner.md | hackathon-cosmos3-reasoner.md |  |  |
| hackathon-isaac-token-factory.md | hackathon-isaac-token-factory.md |  |  |
| install.md | install.md |  |  |
| nvidia-platform-architecture-coverage.md | nvidia-platform-architecture-coverage.md |  |  |
| quickstart.md | quickstart.md |  |  |
| releasing.md | releasing.md |  |  |
| run-lifecycle.md | run-lifecycle.md |  |  | [...] | README.md | README.md |  |  |
| agent.md | agent.md |  |  |
| b300-validation-matrix.md | b300-validation-matrix.md |  |  |
| cli-errors.md | cli-errors.md |  |  |
| cluster-backends.md | cluster-backends.md |  |  |
| configuration.md | configuration.md |  |  |
| credentials.yaml.example | credentials.yaml.example |  |  |
| fleet-kuberay.md | fleet-kuberay.md |  |  |
| fleet-rtx-pro-6000-mig.md | fleet-rtx-pro-6000-mig.md |  |  | [...] | Task | Read |
 --- |
| Manage Kubernetes | Kubernetes · GPU driver strategy |
| Configure workflow scheduling | SkyPilot setup |
| Install shared Workbench with a persistent HTTPS endpoint | Shared server setup |
| Deploy a separate upstream SkyPilot API | Optional Helm recipe |
| Manage fleets or Slurm | Cluster backends · Fleet storage verification · RTX MIG |
| Choose an image and GPU | Public image catalog · compatibility matrix |

Source: [nebius-physical-ai/docs at main · nebius/nebius-physical-ai · GitHub](https://github.com/nebius/nebius-physical-ai/tree/main/docs)

### 5. nebius-physical-ai/SECURITY.md at main · nebius/nebius-physical-ai · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai/blob/main/SECURITY.md>
- Score: 0.2930255

Every connection fetches the peer certificate in binary form and compares `hashlib.sha256(certificate).hexdigest()` against the expected fingerprint (`reverse_client.py` `connect()`; `cli/workbench/leisaac.py` `_select_agent_leisaac_run()` uses `secrets.compare_digest` and fails the connection on mismatch).
 The expected fingerprint is captured at agent-deploy time by `_agent_certificate_sha256()`, which records the fingerprint of whatever certificate the fresh agent endpoint presents. [...] To report a security issue, please use the GitHub Security Advisory "Report a Vulnerability" tab.

The Nebius team will send a response indicating the next steps in handling your report. After the initial reply to your report, the Nebius team will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

## Supported Versions

Security updates are provided for the following versions of Nebius Physical AI Solutions: [...] More file actions

## Latest commit

## History

History

History

112 lines (83 loc) · 5.38 KB

/

# SECURITY.md

Copy path

## File metadata and controls

112 lines (83 loc) · 5.38 KB

Raw

Copy raw file

Download raw file

Outline

Edit and raw actions

# Security Policy

## Reporting Security Issues

The Nebius team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

Source: [nebius-physical-ai/SECURITY.md at main · nebius/nebius-physical-ai · GitHub](https://github.com/nebius/nebius-physical-ai/blob/main/SECURITY.md)

### 6. RevCore/word2index_redial2.json at main · JD-AI-Research-NLP/RevCore · GitHub

- URL: <https://github.com/JD-AI-Research-NLP/RevCore/blob/main/word2index_redial2.json>
- Score: 0.039096043

2828, "Mall": 2829, "immensely": 2830, "@104930": 2831, "@150501": 2832, "@205266": 2833, "futuristic": 2834, "Freddy": 2835, "quickly": 2836, "nominated": 2837, "Tucker": 2838, "physical": 2839, "anyways": 2840, "Jonah": 2841, "@155632": 2842, "Picture": 2843, "@131630": 2844, "heaven": 2845, "bored": 2846, "score": 2847, "ton": 2848, "bout": 2849, "don": 2850, "Naked": 2851, "@177276": 2852, "@83948": 2853, "pre-screening": 2854, "@171245": 2855, "Seems": 2856, "oldies": 2857, "continuing": [...] "icky": 17930, "theeed": 17931, "thougth": 17932, "@127908": 17933, "@101284": 17934, "Comdies": 17935, "Scorces": 17936, "Buried": 17937, "Dascaucus": 17938, "overshadowed": 17939, "Lesley": 17940, "map": 17941, "dryland": 17942, "@155200": 17943, "coming-of-age": 17944, "Mottola": 17945, "Evan": 17946, "graduate": 17947, "graduating": 17948, "virginities": 17949, "@176631": 17950, "raunch": 17951, "castle": 17952, "newish": 17953, "@Christmas": 17954, "@Scrooged": 17955, "zooey": 17956, [...] 13185, "dan": 13186, "@108217": 13187, "@125663": 13188, "Clayton": 13189, "trappings": 13190, "@114952": 13191, "suspension": 13192, "chuckles": 13193, "chiller": 13194, "depictions": 13195, "chillers": 13196, "cannibals": 13197, "natives": 13198, "happiness": 13199, "meteor": 13200, "cell": 13201, "Kazakhstan": 13202, "Trump": 13203, "activity": 13204, "kindly": 13205, "@198274": 13206, "instantwatcher": 13207, "fishborne": 13208, "signal": 13209, "Jody": 13210, "Laurence": 13211,

Source: [RevCore/word2index_redial2.json at main · JD-AI-Research-NLP/RevCore · GitHub](https://github.com/JD-AI-Research-NLP/RevCore/blob/main/word2index_redial2.json)

### 7. conversational_quiz_bot/OpenTriviaQA_JSON/literature.json at master · mrinalpande/conversational_quiz_bot · GitHub

- URL: <https://github.com/mrinalpande/conversational_quiz_bot/blob/master/OpenTriviaQA_JSON/literature.json>
- Score: 0.020225683

Cedric Diggory"]},{"question":"In Harry Potter and the Philosophers Stone, what was the password to the Gryffindor tower during Halloween?","category":"literature","answer":"Pig snout","choices":["Pig snout","Fairy lights","None of these","Zebras tail"]},{"question":"In Harry Potter and the Philosophers Stone, who gave Nearly-Headless Nick the rejection letter from the Headless Hunt?","category":"literature","answer":"Sir Patrick Delaney-Podmore","choices":["Sir Delaney Patrick-Podmore","Sir [...] can Harry Potter speak?","category":"literature","answer":"Parseltounge","choices":["Goblin","English","Mermish","Parseltounge"]},{"question":"Cornelia Fudge is the Minister of Magic.","category":"literature","answer":"False","choices":["False","True"]},{"question":"Hermione was supposed to turn into this person after drinking the Polyjuice Potion.","category":"literature","answer":"Millicent Bulstrode","choices":["Millicent Bulstrode","Crabbe","Millie Vanilli","Pansy [...] Black","Sir Delaney Patrick-Podmore"]},{"question":"Who lost the list of passwords for the Gryffindor tower in Harry Potter and the Prisoner of Azkaban?","category":"literature","answer":"Neville Longbottom","choices":["Dean Thomas","Neville Longbottom","Ron Weasley","Padma Patil"]},{"question":"In Harry Potter and the Half-Blood Prince, who was bitten by the werewolf Fenfir Greyback?","category":"literature","answer":"Bill","choices":["Ron","Bill","Charlie","Percy"]},{"question":"Who killed

Source: [conversational_quiz_bot/OpenTriviaQA_JSON/literature.json at master · mrinalpande/conversational_quiz_bot · GitHub](https://github.com/mrinalpande/conversational_quiz_bot/blob/master/OpenTriviaQA_JSON/literature.json)

### 8. Concatenated DSPy documentation (May 12, 2025) · GitHub

- URL: <https://gist.github.com/damek/c5dcf37e5776128a7470c5708b5779f4>
- Score: 0.016633095

DSPy exposes a very small API that you can learn quickly. However, building a new AI system is a more open-ended journey of iterative development, in which you compose the tools and design patterns of DSPy to optimize for your objectives. The three stages of building AI systems in DSPy are:

DSPy Programming. This is about defining your task, its constraints, exploring a few examples, and using that to inform your initial pipeline design. [...] sidebar\_position: 1
hide:

DSPy{ width="200", align=left }

DSPy

# Programming—not prompting—LMs

PyPI Downloads

PyPI Downloads

DSPy is a declarative framework for building modular AI software. It allows you to iterate fast on structured code, rather than brittle strings, and offers algorithms that compile AI programs into effective prompts and weights for your language models, whether you're building simple classifiers, sophisticated RAG pipelines, or Agent loops. [...] ## 2) Optimizers tune the prompts and weights of your AI modules.

DSPy provides you with the tools to compile high-level code with natural language annotations into the low-level computations, prompts, or weight updates that align your LM with your program’s structure and metrics. If you change your code or your metrics, you can simply re-compile accordingly.

Source: [Concatenated DSPy documentation (May 12, 2025) · GitHub](https://gist.github.com/damek/c5dcf37e5776128a7470c5708b5779f4)
