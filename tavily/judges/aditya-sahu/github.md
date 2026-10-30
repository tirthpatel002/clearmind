---
question: "What is Aditya Sahu's public GitHub profile and notable public repositories?"
query: "\"Aditya Sahu\" NVIDIA TME, Jetson Platform"
fetchedAt: "2026-10-30T14:40:17.339Z"
tool: tavily
searchDepth: basic
searchTopic: general
includeDomains: ["github.com"]
mode: search
creditsUsed: 1
match: confident
group: judges
subject: "Aditya Sahu"
subjectRole: "TME, Jetson Platform, NVIDIA"
visibleTo: ["judge-aditya-sahu"]
mock: false
sources:
  - "https://github.com/NVIDIA-AI-IOT/jetson-ai-lab/blob/main/src/content/tutorials/setup/yocto-on-jetson.mdx"
  - "https://github.com/NVIDIA-AI-IOT/jetson-device-skills"
  - "https://github.com/NVIDIA-AI-IOT/jetson-bsp-skills"
  - "https://github.com/NVIDIA-AI-IOT/reachy-mini-jetson-assistant"
  - "https://github.com/solidlabnetwork/awesome-distributed-LLM"
---
# What is Aditya Sahu's public GitHub profile and notable public repositories?


Query: `"Aditya Sahu" NVIDIA TME, Jetson Platform` (Tavily basic search, fetched 2026-10-30T14:40:17.339Z)



## Answer

Aditya Sahu is listed as an author in the GitHub repository for Jetson AI Lab, specifically in the file "yocto-on-jetson.mdx" under the "authors" section. The repository provides instructions for setting up Yocto on Jetson devices, including steps for unpacking the tarball into a fresh directory and setting the MACHINE variable to the target hardware. The Jetson Device Skills project also mentions Aditya Sahu's involvement, as it was developed and validated on the Jetson platform with assistance from Jetson Device Skills.

## Results (5)

### 1. jetson-ai-lab/src/content/tutorials/setup/yocto-on-jetson.mdx at main · NVIDIA-AI-IOT/jetson-ai-lab · GitHub

- URL: <https://github.com/NVIDIA-AI-IOT/jetson-ai-lab/blob/main/src/content/tutorials/setup/yocto-on-jetson.mdx>
- Score: 0.54782754

| order | 1 |
| tags | |  |  |  |  |  |  |  |  |  |  |  |  |  |  ---  ---  ---  ---  ---  ---  | setup | getting-started | yocto | oe4t | meta-tegra | tegra-demo-distro | wrynose | jetpack-7 | jetson-thor | jetson-orin | orin-nano | initrd-flash | flashing | |
| featured | false |
| authors | |  |  |  |  |  |  |  |  |  |  |  ---  ---  ---  ---  --- | | | name | github |  --- | | Kurt Kiefer | kekiefer | | | name | github |  --- | | Aditya Sahu | adsahu-nv | | | [...] Set `MACHINE` to your target, then unpack the tarball into a fresh directory. Use the value from the table that matches your hardware:

```
{"export MACHINE=\"jetson-agx-thor-devkit\""}
```

```
{"export MACHINE=\"p3737-0000-p3701-0005\""}
```

```
{"export MACHINE=\"jetson-orin-nano-devkit-nvme\""}
```

Then unpack:

```
~ cd ~ ~${MACHINE}
```

💡 Tip

Use a fresh empty directory if you unpack more than one target so the contents don't mix.

## Step 3: Put the Jetson in Recovery Mode [...] 1. Power off the developer kit and disconnect power.
2. Place a jumper across pin 9 (GND) and pin 10 (FORCE\_RECOVERY) of the J14 header.
3. Reconnect power (or press the power button).
4. Wait a couple of seconds, then remove the jumper.

See Orin Nano Developer Kit: Force Recovery Mode for the official steps.

Confirm the host can see an NVIDIA recovery-mode USB device:

```
lsusb -d 0955:
```

The output should include an `APX` device, which indicates the Jetson is in recovery mode.

Source: [jetson-ai-lab/src/content/tutorials/setup/yocto-on-jetson.mdx at main · NVIDIA-AI-IOT/jetson-ai-lab · GitHub](https://github.com/NVIDIA-AI-IOT/jetson-ai-lab/blob/main/src/content/tutorials/setup/yocto-on-jetson.mdx)

### 2. GitHub - NVIDIA-AI-IOT/jetson-device-skills: Foundational Agent Skills for NVIDIA Jetson Device · GitHub

- URL: <https://github.com/NVIDIA-AI-IOT/jetson-device-skills>
- Score: 0.1607532

```
jetson-device-skills/ ├── README.md ├── LICENSE ├── install.sh ├── agents/ └── skills/ ├── jetson-diagnostic/ ├── jetson-headless-mode/ ├── jetson-inference-mem-tune/ ├── jetson-llm-benchmark/ ├── jetson-llm-serve/ ├── jetson-memory-audit/ ├── jetson-package/ ├── jetson-speculative-decoding/ ├── jetson-video-benchmark/ ├── jetson-video-capability/ ├── jetson-video-pipeline/ ├── jetson-video-recipe/ └── jetson-video-setup/ 
```

## Related Resources [...] | Skill | What it helps you do |
 --- |
| jetson-diagnostic | Inspect device identity, memory, GPU activity, thermals, power, storage, and services. |
| jetson-memory-audit | Measure memory usage and verify the effect of memory reclamation. |
| jetson-headless-mode | Configure a headless Jetson by managing desktop and background services. |
| jetson-inference-mem-tune | Choose inference runtimes and memory settings for the device. | [...] | jetson-llm-serve | Configure Jetson-appropriate LLM serving workflows. |
| jetson-llm-benchmark | Measure LLM inference performance with structured benchmark results. |
| jetson-package | Select Jetson-compatible packages, wheels, and containers. |
| jetson-speculative-decoding | Explore Jetson-specific speculative decoding configurations. |
| jetson-video-setup | Install and verify native Video Codec SDK and PyNvVideoCodec components. |

Source: [GitHub - NVIDIA-AI-IOT/jetson-device-skills: Foundational Agent Skills for NVIDIA Jetson Device · GitHub](https://github.com/NVIDIA-AI-IOT/jetson-device-skills)

### 3. GitHub - NVIDIA-AI-IOT/jetson-bsp-skills: Agentic Skills for Jetson BSP Customization · GitHub

- URL: <https://github.com/NVIDIA-AI-IOT/jetson-bsp-skills>
- Score: 0.14592923

| Deploy | `/jetson-promote-image` | Stages customized overlay files and build outputs into the BSP image. |
| Deploy | `/jetson-flash-image` | Flashes a promoted BSP image to a Jetson DUT in recovery mode. |
| Deploy | `/jetson-validate-image` | Runs static BSP checks and on-target validation after flashing. |
| Inspection | `/jetson-print-bsp-info` | Prints a quick host-side summary of a Linux\_for\_Tegra BSP tree. | [...] | Stage | What happens |
 --- |
| Setup | Create/select the active target, download or register BSP inputs, extract the image, initialize sources, and link documents. |
| Customize | Apply BSP changes such as pinmux, USB, PCIe, UPHY, clocks, fan, nvpmodel, camera, MGBE, or memory tuning. |
| Build | Rebuild source-side artifacts when a customization changed kernel-side sources. |
| Deploy | Promote workspace changes into the BSP image, flash the device, and validate the result. | [...] | Customization | `/jetson-customize-uphy` | Allocates UPHY lanes across PCIe/USB3/MGBE on custom carriers. |
| Customization | `/jetson-customize-mgbe` | Configures MGBE Ethernet controller, PHY, and MAC settings. |
| Customization | `/jetson-customize-camera` | Edits camera device tree overlays for CSI sensors and tegra-camera-platform. |
| Customization | `/jetson-customize-clocks` | Edits BSP-side clock, DVFS, governor, and BPMP DTB settings. |

Source: [GitHub - NVIDIA-AI-IOT/jetson-bsp-skills: Agentic Skills for Jetson BSP Customization · GitHub](https://github.com/NVIDIA-AI-IOT/jetson-bsp-skills)

### 4. GitHub - NVIDIA-AI-IOT/reachy-mini-jetson-assistant: Fully local voice-and-vision assistant for Reachy Mini Lite on NVIDIA Jetson Orin Nano · GitHub

- URL: <https://github.com/NVIDIA-AI-IOT/reachy-mini-jetson-assistant>
- Score: 0.14310412

## Development and Validation

This project was developed and validated on the NVIDIA Jetson platform with assistance from Jetson Device Skills, a collection of foundational agent skills for working with Jetson devices.

Jetson Device Skills supported hardware inspection, JetPack and CUDA environment validation, dependency verification, performance diagnostics, and device-level troubleshooting during development and bring-up. [...] Live camera feed from the shared camera buffer, including face-detection and tracking state, with VLM capture using the latest stable frame
 Conversation log with streaming VLM responses
 Push-to-talk button (starts muted, click to unmute)
 System stats — CPU, GPU, RAM usage
 Config panel — displays active settings
 Platform detection — shows the specific Jetson model

Access at ` The web UI adds minimal overhead (~5 MB RAM).

## Configuration [...] ```

Source: [GitHub - NVIDIA-AI-IOT/reachy-mini-jetson-assistant: Fully local voice-and-vision assistant for Reachy Mini Lite on NVIDIA Jetson Orin Nano · GitHub](https://github.com/NVIDIA-AI-IOT/reachy-mini-jetson-assistant)

### 5. GitHub - solidlabnetwork/awesome-distributed-LLM: An Evolving List of Distributed LLM and Multimodal LLM Papers and Repositories · GitHub

- URL: <https://github.com/solidlabnetwork/awesome-distributed-LLM>
- Score: 0.083958134

title{Communication-efficient learning of deep networks from decentralized data}{} author{McMahan, H Brendan and Moore, Eider and others}{} journal{arXiv:1602.05629}{} year{2016}{} @misc nvidia2024jetson author{NVIDIA Developer Blog}{} title{Bringing Generative AI to Life with NVIDIA Jetson}{} year{2024}{} url{ note{Accessed: 2024-12-19}{} @misc verge2024nvidia author{The Verge}{} title{{NVIDIA's \$249 Dev Kit Promises Cheap, Small AI Power}}{} year{2024}{} url{ note{Accessed: 2024-12-19}{} [...] and Alastruey, Belen and Andrews, Pierre and Coria, Mariano and Couairon, Guillaume and Costa-juss{\`a}, Marta R and others}{} journal{arXiv preprint arXiv:2412.08821}{} year{2024}{} @misc li2018federated title{Federated Optimization in Heterogeneous Networks}{} author{Tian Li and Anit Kumar Sahu and Manzil Zaheer and Maziar Sanjabi and Ameet Talwalkar and Virginia Smith}{} year{2018}{} eprint{1812.06127}{} archivePrefix{arXiv}{} primaryClass{cs.LG}{} @article mcmahan2016communication

Source: [GitHub - solidlabnetwork/awesome-distributed-LLM: An Evolving List of Distributed LLM and Multimodal LLM Papers and Repositories · GitHub](https://github.com/solidlabnetwork/awesome-distributed-LLM)
