# Bottlenecker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

**Browser-based system architecture load simulator by [Arkynate Labs](https://labs.arkynate.com).**

Model your system with visual nodes, wire them together, simulate traffic, and find bottlenecks — all in the browser with no backend required.

Live at: **https://bottlenecker.arkynate.com**

---

## Features

- **Visual canvas** — drag-and-drop nodes for servers, load balancers, databases, caches, and queues
- **Load simulation** — configure a load generator with QPS, propagate traffic through your architecture, and see which components saturate first
- **Bottleneck detection** — nodes change colour (yellow → orange → red) as utilisation increases; the analysis bar surfaces critical paths
- **Edge distribution** — split traffic by percentage, absolute QPS, or auto equal-split across outgoing edges
- **Multi-select** — left-drag on the canvas to lasso-select multiple nodes; drag any selected node to move the whole group
- **Config panel** — click any node or edge to tune its properties inline

## Node Types

| Node | Key config |
|------|-----------|
| Load Generator | Output QPS |
| Load Balancer | Max QPS, strategy (round-robin / weighted / least-conn) |
| Server | Max QPS, instances |
| Database | Max read/write QPS, read replicas, DB type |
| Cache | Hit rate %, max QPS, cache type |
| Queue | Throughput per consumer, consumer count |

## Tech Stack

- React 19 + TypeScript
- [@xyflow/react](https://reactflow.dev) v12 — canvas and node graph
- Zustand — diagram state
- Vite + TailwindCSS v4

## Getting Started

```bash
git clone https://github.com/Jabito/arkynate-bottlenecker.git
cd arkynate-bottlenecker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deployment

Deployed as a static site behind Nginx on Kubernetes.

```
k8s/
  base/       — namespace, deployment, service, ingress
  overlays/
    dev/      — dev image tag + host overrides
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open public issues for security concerns.

## License

[MIT](LICENSE)

---

Made with love by [Arkynate Labs](https://labs.arkynate.com)
