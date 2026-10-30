---
question: "What is Joe Sarabia's public GitHub profile and notable public repositories?"
query: "\"Joe Sarabia\" Nebius Director of Product, Ecosystem"
fetchedAt: "2026-10-30T14:33:04.689Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 2
match: uncertain
fallbackQuery: "\"Joe Sarabia\" Ecosystem"
group: judges
subject: "Joe Sarabia"
subjectRole: "Director of Product, Ecosystem, Nebius"
visibleTo: ["judge-joe-sarabia"]
mock: false
sources:
  - "https://github.com/opencolin/nebius-ecosystem-cookbook/blob/main/build_partners.py"
  - "https://github.com/nebius/nebius-k8s-applications"
  - "https://github.com/nebius/nebius-physical-ai"
  - "https://github.com/nebius/nebius-physical-ai/blob/main/docs/architecture/partner-skills-roadmap.md"
  - "https://github.com/jsarabia"
  - "https://github.com/mlaa/mla14.org/blob/master/app/data/program.json"
  - "https://github.com/gayanvoice/top-github-users/blob/main/markdown/followers/venezuela.md"
---
# What is Joe Sarabia's public GitHub profile and notable public repositories?


Query: `"Joe Sarabia" Nebius Director of Product, Ecosystem` (Tavily basic search, fetched 2026-10-30T14:33:04.689Z)

Fallback query (first pass had no clear name+company match): `"Joe Sarabia" Ecosystem`

> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.


## Answer

The sources indicate that Joe Sarabia is associated with GitHub under the username "jsarabia." His GitHub profile lists several achievements and repositories, including "Radiosity-WebGL," "Heap-Dijkstra-Kruskal," "WebCL-Path-Tracer," and "photon-mapping-WebCL." However, the sources do not provide information about Joe Sarabia's role as Director of Product, Ecosystem for Nebius.

## Results (7)

### 1. nebius-ecosystem-cookbook/build_partners.py at main · opencolin/nebius-ecosystem-cookbook · GitHub

- URL: <https://github.com/opencolin/nebius-ecosystem-cookbook/blob/main/build_partners.py>
- Score: 0.32094952

Title: nebius-ecosystem-cookbook/build_partners.py at main · opencolin/nebius-ecosystem-cookbook · GitHub
## Navigation Menu. You signed in with another tab or window. ## Repository navigation. ## Expand file tree. ## File metadata and controls. Source: .cache/partner-cookbook-src (cloned by build.sh).""". import json, os, re, html, shutil. from build\_cookbook import render\_markdown, slug, title\_of, first\_para, ROOT, IMG\_EXT. REPO = "https://github.com/nebius/nebius-partner-cookbook". GH\_TREE = REPO + "/tree/main". GH\_BLOB = REPO + "/blob/main". def rewrite\_links(body, rel):. """Relative non-image file links -> source on the partner repo; images stay relative.""". attr, url = m.group(1), m.group(2). ext = os.path.splitext(url.split("?")[0])[1].lower(). if ext in IMG\_EXT:. return f'{attr}="{GH\_BLOB}/{rel}/{clean}" target="\_blank" rel="noopener"'. def pills(items, cls="pill"):. return "".join(f'{html.escape(str(x))}' for x in items if x). stack = list(st.get("primary", [])) + list(st.get("secondary", [])). facts.append("run " + rj["estimatedRunTime"]). qs = rj.get("quickstart", {}) or {}. code = "\n".join(x for x in [qs.get("clone"), qs.get("configure"), qs.get("run")] if x). qs\_block = (f'Run it locally'. {html.escape(code)}{html escape code}. def shell(title, body, depth, source\_url, meta\_top=""):. f'View recipe on GitHub ↗') if source\_url else "". for p in d.rglob("\*"):. dest = out\_dir / p.relative\_to(d). dest.parent.mkdir(parents=True, exist\_ok=True). text = readme.read\_text(encoding="utf-8"). rj = json.loads(rjp.read\_text(encoding="utf-8")). sl = rj.get("slug") or slug(d.name). return {"dir": d, "slug": sl, "rel": rel, "kind": kind, "rj": rj, "text": text, "title": title}. out\_dir.mkdir(parents=True, exist\_ok=True). copy\_imgs(r["dir"], out\_dir). body = rewrite\_links(render\_markdown(r["text"]), r["rel"]). tagline = rj.get("tagline") or first\_para(r["text"]). stack = list((rj.get("stack", {}) or {}).get("primary", []))[:3]. f'{html.escape(eyebrow)}' if eyebrow else "",. f'{html.escape(diff)}' if diff else ""]). key=lambda r: r["rj"].get("order", 99)). bps = [r for r in recipes if r["kind"] == "blueprint"]. A sequenced arc — each recipe is a typed, observable, '. f'containerized FastAPI agent you can clone and deploy in minutes, building on the one before it.'. {"".join(card(r) for r in recs)}. Complete, deployable reference applications that combine many '. f'recipe concepts into something you could put in front of users.'. The nebius-partner-cookbook — {len(recs)} sequenced recipes + {len(bps)} full blueprint, each integrating a partner (Pinecone, Tavily, LangChain/LangGraph, LangSmith, Stripe, Snowglobe) on Nebius. Typed, observable, containerized, tested — clone one directory and deploy in minutes. (POUT / "index.html").write\_text(page, encoding="utf-8"). raise SystemExit(f"partner cookbook source not found at {PSRC} — clone it first"). for sub, kind in [("cookbooks", "recipe"), ("blueprints", "blueprint")]:. for d in sorted(base.glob("\*")):. if not d.is\_dir() or d.name.startswith("\_"):. f"blueprints={sum(1 for r in recipes if r['kind']=='blueprint')} pages={len(recipes)+1}"). if \_\_name\_\_ == "\_\_main\_\_":.

Source: [nebius-ecosystem-cookbook/build_partners.py at main · opencolin/nebius-ecosystem-cookbook · GitHub](https://github.com/opencolin/nebius-ecosystem-cookbook/blob/main/build_partners.py)

### 2. GitHub - nebius/nebius-k8s-applications: This repository contains the configuration, manifests and Helm charts for deploying and managing Nebius' Kubernetes applications. · GitHub

- URL: <https://github.com/nebius/nebius-k8s-applications>
- Score: 0.28685844

| example-nginx-product | example-nginx-product |  |  |
| flowise | flowise |  |  |
| generative-virtual-screening | generative-virtual-screening |  |  |
| grafana-and-prometheus | grafana-and-prometheus |  |  |
| h2o-3 | h2o-3 |  |  |
| h2oai-h2ogpt | h2oai-h2ogpt |  |  |
| headlamp | headlamp |  |  |
| jupyterhub | jupyterhub |  |  |
| kubernetes-dashboard | kubernetes-dashboard |  |  |
| litellm | litellm |  |  |
| loki | loki |  |  |
| milvus-milvus | milvus-milvus |  |  | [...] | stable-diffusion-webui | stable-diffusion-webui |  |  |
| vllm | vllm |  |  |
| volcano-volcano | volcano-volcano |  |  |
| weaviate | weaviate |  |  |
| .gitignore | .gitignore |  |  |
| .markdownlint.jsonc | .markdownlint.jsonc |  |  |
| CODEOWNERS | CODEOWNERS |  |  |
| Chart.yaml | Chart.yaml |  |  |
| Create-Application-Guide.md | Create-Application-Guide.md |  |  |
| LICENSE | LICENSE |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
|  | [...] ## Overview

This repository serves as a central hub for managing and deploying applications for Kubernetes built for the Nebius platform. These applications are designed to ensure high availability, scalability and seamless integration with the Nebius ecosystem.

 Airflow
 Argo CD
 CVAT
 Flowise
 H2O
 h2oGPT
 JupyterHub
 Milvus
 MLflow
 NVIDIA® GPU Operator
 NVIDIA® Network Operator
 Qdrant
 Ray Cluster
 Ray Serve
 Stable Diffusion WebUI
 vLLM
 Weaviate

## Getting started

Source: [GitHub - nebius/nebius-k8s-applications: This repository contains the configuration, manifests and Helm charts for deploying and managing Nebius' Kubernetes applications. · GitHub](https://github.com/nebius/nebius-k8s-applications)

### 3. GitHub - nebius/nebius-physical-ai: Agent control plane for Physical AI on Nebius: infrastructure setup and management, simulation, robot policy training, synthetic data, and evaluation. · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai>
- Score: 0.28548196

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
| DESIGN.md | DESIGN.md |  |  | [...] | EVIDENCE.md | EVIDENCE.md |  |  |
| FIXME.md | FIXME.md |  |  |
| FTUE-AUDIT.md | FTUE-AUDIT.md |  |  |
| LICENSE | LICENSE |  |  |
| Makefile | Makefile |  |  |
| README.md | README.md |  |  |
| SECURITY.md | SECURITY.md |  |  |
| demo-script-final.md | demo-script-final.md |  |  |
| trivy.yaml | trivy.yaml |  |  |
| two\_vm.md | two\_vm.md |  |  |
|  | [...] | Name | Name | Last commit message | Last commit date |
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

### 4. nebius-physical-ai/docs/architecture/partner-skills-roadmap.md at main · nebius/nebius-physical-ai · GitHub

- URL: <https://github.com/nebius/nebius-physical-ai/blob/main/docs/architecture/partner-skills-roadmap.md>
- Score: 0.22385216

## Attribution

The current PAIDF ecosystem source is . Its OSMO agent skills are distinct from , the Apache-2.0 Airflow-on-Kubernetes scaler for the currently published IAA and EVG DAGs. NPA uses neither alternate orchestrator; exact reviewed revisions and boundaries are in `skills/NOTICE-NVIDIA-PAIDF` and the separately named direct translations' `reports/upstream.json` artifacts. [...] | Skill | Capability | Upstream | License | Lands when |
 ---  --- 
| `usd-performance-tuning` | USD scene perf diagnosis + Scene Optimizer optimization | `omniverse-usd-performance-tuning` | Apache-2.0 | USD becomes a first-class NPA artifact and a Kit/Scene-Optimizer runtime is available on Nebius |
| `realtime-viewer` | ovrtx/ovstream USD viewer apps (browser/local/native) | `omniverse-realtime-viewer` | Apache-2.0 | An interactive USD viewer is a product requirement beyond Rerun | [...] | `video-data-augmentation` | Cosmos-Transfer augmentation + VLM auto-labeling | `physical-ai-video-data-augmentation` | CC-BY-4.0 AND Apache-2.0 | Core path landed: the separately named `workflows/testing/nvidia-paidf-vda-cosmos-transfer25.yaml` (SkyPilot, no OSMO) implements real arbitrary-input annotate → augment → evaluate → re-label → curate → visualize with pinned provenance and output-to-S3; optional upstream flow variants such as SeedVR2 super-resolution remain roadmap work |

Source: [nebius-physical-ai/docs/architecture/partner-skills-roadmap.md at main · nebius/nebius-physical-ai · GitHub](https://github.com/nebius/nebius-physical-ai/blob/main/docs/architecture/partner-skills-roadmap.md)

### 5. jsarabia (Joe Sarabia) · GitHub

- URL: <https://github.com/jsarabia>
- Score: 0.21710542

Title: jsarabia (Joe Sarabia) · GitHub
## Navigation Menu. You signed in with another tab or window. Reload to refresh your session. You switched accounts on another tab or window. View jsarabia's full-sized avatar. # Joe Sarabia jsarabia. ## Achievements. Achievement: Pair ExtraordinaireAchievement: YOLOAchievement: StarstruckAchievement: QuickdrawAchievement: Arctic Code Vault ContributorAchievement: Pull Sharkx3. ## Popular repositories Loading. Uses Histograms of Oriented Gradients (HOG) as a feature vector for a linear SVM to detect people in images. 2. Radiosity-WebGL  Radiosity-WebGL  Public. Uses a hemicube algorithm for radiosity rendering in WebGL. 3. Heap-Dijkstra-Kruskal  Heap-Dijkstra-Kruskal  Public. Python code implementing a heap, Dijkstra's shortest path algorithm, and Kruskal's minimum spanning tree algorithm. 4. WebCL-Path-Tracer  WebCL-Path-Tracer  Public. a path tracer using WebCL. 5. photon-mapping-WebCL  photon-mapping-WebCL  Public. photon mapping algorithm implemented in WebCL. Extended SimpleScalar to support the Way Level Share Cache structure. Something went wrong, please refresh the page to try again. If the problem persists, check the GitHub status page or contact support. ### Uh oh! There was an error while loading. You can’t perform that action at this time.

Source: [jsarabia (Joe Sarabia) · GitHub](https://github.com/jsarabia)

### 6. mla14.org/app/data/program.json at master · mlaa/mla14.org

- URL: <https://github.com/mlaa/mla14.org/blob/master/app/data/program.json>
- Score: 0.017257717

You can’t perform that action at this time. [...] Skip to content

## Navigation Menu

 · 657 KB

master

## Breadcrumbs

1.   mla14.org
2.   /app
3.   /data

/
# program.json

Copy path

Top

## File metadata and controls

   Code 
   Blame 

1 lines (1 loc) · 657 KB

Raw

Copy raw file

Download raw file

Open symbols panel

Edit and raw actions

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

Source: [mla14.org/app/data/program.json at master · mlaa/mla14.org](https://github.com/mlaa/mla14.org/blob/master/app/data/program.json)

### 7. top-github-users/markdown/followers/venezuela.md at main

- URL: <https://github.com/gayanvoice/top-github-users/blob/main/markdown/followers/venezuela.md>
- Score: 0.012606726

Jul 17, 2026 — The number of followers of users in Venezuela on 2026/7/17 2:13 AM UTC . This list contains users from Venezuela and cities Caracas Maracay ...Read more

Source: [top-github-users/markdown/followers/venezuela.md at main](https://github.com/gayanvoice/top-github-users/blob/main/markdown/followers/venezuela.md)
