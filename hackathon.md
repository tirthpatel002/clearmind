# Hackathon: Nebius x NVIDIA Global AI Hackathon

This file summarises the hackathon rules and how Clearmind uses the sponsor technology.

## Goal

Clearmind is submitted to the Nebius x NVIDIA Global AI Hackathon on Devpost (Personal AI track) and is also entered for the Best Use of Tavily bonus prize.

- Hackathon page: https://nebiusglobalaihackathon.devpost.com/ (rules: https://nebiusglobalaihackathon.devpost.com/rules)
- Deadline: "Oct 30, 2026 @ 10:00am PDT" (10:30 PM IST).
- Submission Period (rules): "Wednesday, August 26, 2026 (9:00 am Pacific Time) – Friday, October 30, 2026 (10:00 am Pacific Time)".
- Source copies of the pages (accessed Oct 30, 2026): `docs/hackathon/page_rules.txt`, `docs/hackathon/main.html`. The quotes below come from those copies.

## Rules (quoted)

What to create:
> Entrants must create a working software application that runs on either Nebius Token Factory or Nebius AI Cloud and uses at least one NVIDIA open source model, and that fits into one of the four hackathon tracks below (each a "Project").

> Runs on Nebius Token Factory or Nebius AI Cloud" means the project makes a runtime call to the Token Factory inference API, or is deployed/run using Nebius AI Cloud compute (Serverless Jobs, Serverless Endpoints, or DevPods).

Tracks: Coding and Agentic Engineering, Best Apps and Agents, Personal AI, Physical AI. Personal AI track text:
> Build an always-on, private assistant that works for you while keeping your data under your control. Give it persistent memory, reusable skills, access to the tools and information you choose, and the ability to carry out tasks across your daily workflows.

Submission requirements (summarised from the rules list; see the source copy for exact wording):
- A Project built with the required developer tools that meets the Project Requirements.
- A URL to a working demo, hosted application or test build.
- A text description of features and functionality.
- A public code repository URL (GitHub, GitLab or Bitbucket) with all source, assets and instructions. "The repository must be public and open source by including an open source license file (such as Apache 2.0, MIT, or MPL 2.0). This license should be detectable and visible at the top of the repository page (in the About section)."
- A README with setup instructions; "Make sure to highlight how you've used NVIDIA Nemotron or other NVIDIA open source models and where Token Factory accelerated your workflow and any other Nebius Tools or Services used."
- A demo video that "should be less than three (3) minutes. Judges are not required to watch beyond three minutes", publicly visible on YouTube.
- Identify which track the Project is submitted into.
- Free access to the working Project for judges until the Judging Period ends.

Best Use of Tavily ($3,000 USD, 1 winner), eligibility:
> All Eligible Submissions that make a functional, runtime call to the Tavily API as part of its solution.

Multiple prizes:
> Each Project is eligible for one (1) Overall Award OR one (1) Track Award and one (1) Bonus Award.

## Judging criteria (quoted, rules §6)

Stage One:
> The first stage will determine via pass/fail whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon. A Project reasonably fits the theme if it is a genuine attempt at the track's stated goal, not a superficial rebrand of an unrelated idea.

Stage Two, "equally weighted criteria":
- **Technological Implementation:** How well is the project built, and how effectively does it use Nebius Token Factory or AI Cloud model(s), and NVIDIA Nemotron or other NVIDIA open source models as part of the solution?
- **Design:** Does the project deliver a complete, coherent product experience not just a technical proof of concept?
- **Potential Impact:** Does the project make a credible, specific case for solving a real problem for a real audience and does the solution actually address it based on what's demonstrated?
- **Quality of the Idea:** Is this a creative, non-obvious use of Nebius Token Factory or AI Cloud model(s), and NVIDIA Nemotron or other NVIDIA open source models and does the team show genuine understanding of the problem space?

Ties: "the tied Submission with the highest score in the first applicable criterion listed above will be considered the higher scoring Submission", then the next criterion, then a judges' vote.

Prizes: Grand Prize $20,000; 2nd $10,000; 3rd $6,000; each track winner an NVIDIA Jetson Orin Nano; bonus: Best Use of Tavily $3,000, City Winner Awards 20 × $500, Most Valuable Feedback 10 × $100 plus NVIDIA swag pack.

## Sponsors and tech we use

- **Nebius Token Factory**: all runtime model calls (chat and embeddings) go through its inference API.
- **NVIDIA Nemotron** (via Token Factory): answers, extraction and titles.
- **Qwen3-Embedding-8B** (via Token Factory): embeddings for memories and entities.
- **Tavily**: research on the hackathon, judges and sponsors was gathered with Tavily and then loaded into Clearmind as memories (`tavily/*.md`) through the general ingest. Honest note: that research was run by a separate script and loaded afterward; Clearmind itself did not perform the Tavily searches.

## How this file is used

The build seeder (`scripts/seed-build.ts`) ingests the whole repo, including this file, through the general `ingestPath` ingest, so the project's own goal, rules and code are in memory.

