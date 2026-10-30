---
question: "What are Nebius AI Cloud Serverless Jobs and Endpoints?"
query: "Nebius AI Cloud Serverless AI jobs endpoints"
fetchedAt: "2026-10-30T14:27:10.737Z"
tool: tavily
searchDepth: advanced
searchTopic: general
mode: search
creditsUsed: 2
group: sponsors
visibleTo: ["workspace"]
mock: false
sources:
  - "https://docs.nebius.com/serverless/overview"
  - "https://docs.nebius.com/serverless/tutorials/deploy-model"
  - "https://github.com/nebius/serverless-ai-cookbook"
  - "https://www.youtube.com/watch?v=JB_TKS5K1nA"
  - "https://nebius.com/serverless"
---
# What are Nebius AI Cloud Serverless Jobs and Endpoints?


Query: `Nebius AI Cloud Serverless AI jobs endpoints` (Tavily advanced search, fetched 2026-10-30T14:27:10.737Z)



## Answer

The Nebius AI Cloud Serverless AI service provides endpoints for deploying custom models behind HTTP endpoints. To create an endpoint, you can use the web console or CLI. In the web console, navigate to Serverless AI → Endpoints, click Create endpoint, and specify settings like configuration, image path, ports, entrypoint command, and computing resources. The CLI command for creating an endpoint is `nebius ai endpoint create --name <endpoint-name> --image <image-path> --container-command <command> --args <arguments> --platform <platform> --preset <preset> --public --container-port <port> --auth token --token <token> --shm-size <size> --subnet-id <subnet-id>`. The endpoint exposes an API, such as `/v1/chat/completions`, for real-time inference.

## Results (5)

### 1. About Serverless AI - Nebius AI Cloud

- URL: <https://docs.nebius.com/serverless/overview>
- Score: 0.92359936

Serverless AI is a Nebius AI Cloud service for running containerized AI workloads without creating or managing virtual machines (VMs) or clusters. It supports the full AI/ML development workflow: build prototypes and run experiments in interactive Devlab environments, run training, fine-tuning and data processing workloads as jobs, and serve models and applications through endpoints. Provide a container image or select a template, and Serverless AI provisions the compute and storage resources required for each workload. Devlabs, endpoints and jobs run on Compute virtual machines, with usage-based, per-second billing. The underlying VMs are managed by Serverless AI. You can connect to them via SSH, but they aren’t shown as Compute resources and can’t be managed or modified directly like [...] ## Devlabs, endpoints and jobs

Serverless AI supports the end-to-end AI/ML workflow through three deployment types. Choose the deployment type that best fits what you want to do:

 Experiment and prototype: Write code, explore models and data in a browser-based IDE or notebook → Devlab.
 Run a task to completion: Train or fine-tune a model, preprocess data, run batch inference or evaluation → Job.
 Serve requests: Host a model or application at a URL for real-time inference → Endpoint. [...] ## Observability and debugging

Each Serverless AI deployment (a Devlab, an endpoint or a job) has a status that indicates the current stage in the lifecycle. You can view its status and logs on the resource page under Devlabs, Jobs or Endpoints in the web console. Deployments also report GPU and vCPU utilization metrics on the Metrics tab of this page. To investigate errors or unexpected outcomes, see Debugging failed deployments. For metric definitions and details, see Monitoring deployments.

## Pricing and quotas

Serverless AI follows Compute billing and quota rules. Billing depends on whether the deployment is running or stopped:

Source: [About Serverless AI - Nebius AI Cloud](https://docs.nebius.com/serverless/overview)

### 2. Deploying a large language model and chatting with it by using Serverless AI endpoints - Nebius AI Cloud

- URL: <https://docs.nebius.com/serverless/tutorials/deploy-model>
- Score: 0.8773195

Serverless AI lets you deploy and manage endpoints without handling infrastructure yourself. With endpoints, you can create an OpenAI-compatible model backend in a few minutes. This tutorial shows how to prepare your environment, create your first endpoint with an open-source large language model (LLM), and send a chat request. The endpoint is based on the `vllm/vllm-openai:latest` image. vLLM automatically downloads the model from Hugging Face when the endpoint starts. The container exposes an OpenAI-compatible `/v1/chat/completions` API. For a quick walkthrough of the web console workflow, watch the video below. If you prefer other interfaces or written instructions, follow the steps further down.

Visit Nebius Academy for video tutorials to help you get started with Nebius AI Cloud. [...] ## ​ Steps

### ​ Create an endpoint

 Web console
 CLI

1. In the sidebar, go to  Serverless AI → Endpoints.
2. Click  Create endpoint.
3. On the page that opens, specify the following endpoint settings:
    Configuration: Custom.
    Image path: `vllm/vllm-openai:v0.18.0-cu130`.
    Ports: `8000`.
    Entrypoint command:

     ```
     python3 -m vllm.entrypoints.openai.api_server --model Qwen/Qwen3-0.6B --host 0.0.0.0 --port 8000 python3 -m vllm.entrypoints.openai.api_server --model Qwen/Qwen3-0.6B --host 0.0.0.0 --port  8000
     ```
    Bearer token authentication: Enabled. Copy and save the generated token.
    Computing resources: With GPU.
    Available platform: NVIDIA® L40S Intel.
    Preset: 1 GPU — 8 CPUs — 32 GiB RAM.
    Network: Public static IP.
4. Click Create endpoint. [...] nebius ai endpoint create \ nebius  ai  endpoint  create  \ --name qs-vllm-chat \ --name qs-vllm-chat  \ --image vllm/vllm-openai:v0.18.0-cu130 \ --image vllm/vllm-openai:v0.18.0-cu130  \ --container-command "python3 -m vllm.entrypoints.openai.api_server" \ --container-command "python3 -m vllm.entrypoints.openai.api_server"  \ --args "--model $MODEL_ID --host 0.0.0.0 --port 8000" \ --args "--model $MODEL_ID --host 0.0.0.0 --port 8000"  \ --platform gpu-l40s-a \ --platform gpu-l40s-a  \ --preset 1gpu-8vcpu-32gb \ --preset 1gpu-8vcpu-32gb  \ --public \ --public  \ --container-port 8000 \ --container-port  8000  \ --auth token \ --auth  token  \ --token "$AUTH_TOKEN" \ --token  " $AUTH_TOKEN "  \ --shm-size 16Gi \ --shm-size  16Gi  \ --subnet-id "$SUBNET_ID" --subnet-id  " $SUBNET_ID "

Source: [Deploying a large language model and chatting with it by using Serverless AI endpoints - Nebius AI Cloud](https://docs.nebius.com/serverless/tutorials/deploy-model)

### 3. GitHub - nebius/serverless-ai-cookbook · GitHub

- URL: <https://github.com/nebius/serverless-ai-cookbook>
- Score: 0.86331123

## Repository files navigation

# Serverless AI Cookbook

Run GPU workloads on Nebius Serverless — no infrastructure management, per-second billing, GPU in minutes.

This repo contains runnable code samples for Serverless AI Jobs (batch workloads that auto-terminate) and Endpoints (persistent HTTP-accessible services), plus 1-click templates that open the Nebius Console with fields pre-filled. Examples cover model training, fine-tuning, inference serving, AI agents, and scientific simulations.

## Quickstart (30 seconds)

Spin up a GPU job and verify your setup:

```
"-c nvidia-smi" " " # Get the job ID and stream logs # export$(nebius ai job get-by-name --name my-first-job \$( --format jsonpath='{.metadata.id}')'{.metadata.id}' ' ') "$JOB_ID" " $JOB_ID "
``` [...] ### Robotics

 🤖 Positronic + Nebius serverless workflows — Convert datasets, train ACT/SmolVLA, and serve checkpoints as endpoints — all serverless on Nebius. — by vertix · 💻 code
 🦾 norma-core SmolVLA — Nebius fine-tune recipe — Upstream recipe the `robotics/smolva-ft-norma-core` example mirrors. — by norma-core · 💻 code
 🔩 Soft-surface washer pick with Nebius Serverless AI Jobs — A UR10e in Isaac Sim flips a flat washer off a compliant surface; 38 H100 Jobs co-optimize material × maneuver, ES-training checkpoints ride home base64-encoded in the job logs, and a CPU Endpoint serves the grasp-success scorer. — by David Cox · 💻 code · 🎬 video

### MLOps / Pipelines [...] ### 🚀 Quickstarts

Lowest-friction first runs.

 `first-job` — run `nvidia-smi` in a Serverless AI job
 `first-endpoint` — deploy a quick `nginx` endpoint

### 📦 Templates

1-click deploy into the Nebius Console — fields pre-filled; adjust before create if needed.

Source: [GitHub - nebius/serverless-ai-cookbook · GitHub](https://github.com/nebius/serverless-ai-cookbook)

### 4. Get started with Serverless AI on Nebius in minutes

- URL: <https://www.youtube.com/watch?v=JB_TKS5K1nA>
- Score: 0.8622012

[1:52] While jobs are built for execution that ends, service endpoints are built for workloads that need to stay online.
[1:58] Endpoints are designed for realtime interference. When you deploy an endpoint, you're basically saying load this model and make it available to
[2:05] serve requests continuously. In the console under serverless endpoints, the flow is similar to jobs actually. You define the container image, specify the
[2:13] model to load, select your GPU configuration, and configure access settings. And once you deploy it, the endpoint appears and it status moves
[2:22] from starting to running. And if we open the logs tab, we can see that the model is loading and the API server initializing [music] which gives you [...] [3:05] use serverless jobs. If the workloads needs to serve traffic continuously, use serverless endpoints. In both cases, you
[3:13] define the container and compute requirements and Nebus provisions the GPU and manages the life cycle. That consistency is what simplifies the AI
[3:22] development life cycle. You can train, evaluate, and deploy your models all without manually managing infrastructure. Serverless is now
[3:30] available on Nebus and we're very excited to see what you can build with it. Thank you for watching. [...] ### Transcript
[0:00] Hi, my name is Marwan. I'm a technical developer advocate at Nebus and today I want to introduce something new on the
[0:07] platform. Serverless. Serverless [music] changes how you run AI workloads on Nebus. Now instead of provisioning virtual machines, configuring GPUs, and
[0:16] managing life cycle manually, you simply define the workload you want to run and Nebus takes care of all the rest. In other word, you focus on the model and
[0:25] on your task and the platform handles all the compute. And with this release, serverless supports two main capabilities. Serverless jobs and
[0:33] serverless endpoints. They share the same underlying idea, but they serve different purposes. Let's start with jobs.

Source: [Get started with Serverless AI on Nebius in minutes](https://www.youtube.com/watch?v=JB_TKS5K1nA)

### 5. Serverless AI on Nebius | Run GPU Workloads On Demand

- URL: <https://nebius.com/serverless>
- Score: 0.8464638

New

## Devlabs

Interactive dev environments with preinstalled tools like Jupyter and VS Code.

Best for:

 exploratory data analysis
 model prototyping
 debugging training code

Read doc

Available

## Jobs

Runtime for executing containerized finite workloads that start, run and complete.

Best for:

 batch processing
 training experiments
 scientific simulations

Read doc

Available

## Endpoints

Inference environment for deploying custom models behind HTTP endpoints.

Best for:

 custom model serving
 running evaluation workloads
 testing inference pipelines

Read doc

## Getting started with Serverless AI on Nebius AI Cloud

This short video demonstrates how to quickly set up and launch Jobs and Endpoints on Nebius AI Cloud.

## Support the full AI lifecycle [...] ## Support the full AI lifecycle

Serverless AI complements Nebius’ core offering of high-performance AI clusters for large-scale training.

## Prototype

Prototype ideas and debug code in Devlabs.

## Experiment

Run training experiments or batch processing with Jobs.

## Run

Run training, fine-tuning and simulation workloads with Jobs.

## Validate and serve

Validate inference pipeline and serve models through Endpoints.

## Get started

Launch your first workload now by creating an account via the Nebius web console or CLI.

Try it now Book a demo

Source: [Serverless AI on Nebius | Run GPU Workloads On Demand](https://nebius.com/serverless)
