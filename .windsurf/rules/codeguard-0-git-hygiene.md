---
trigger: always_on
title: Git Hygiene & Secrets Scanning
version: 1.0.0
tags: [secrets, privacy, supply-chain]
---

rule_id: codeguard-0-git-hygiene

# Git Hygiene & Secrets Scanning

Treat the repository as public and untrusted. Never commit sensitive data, operational artifacts, or generated reports.

## Prohibited commits

- **Cluster dumps**: files like `cluster-dump-raw.yaml`, `cluster-dump-*.yaml`, or any `kubectl get all -o yaml` output.
- **Secrets**: Kubernetes Secrets, TLS private keys, API keys, passwords, tokens, or connection strings containing credentials.
- **Test/scan reports**: generated HTML/JSON reports from security tools (e.g., `croc-shop-testing/results/`).
- **OS artifacts**: `.DS_Store`, `Thumbs.db`, editor swap files.

## Required patterns

- Use `.gitignore` to block the categories above.
- Reference secrets via environment variables, Kubernetes Secrets, or a secrets manager; never hardcode them.
- Pre-commit, scan for:
  - AWS keys (`AKIA...`, `ASIA...`)
  - Private key blocks (`-----BEGIN PRIVATE KEY-----`, etc.)
  - Password/secret literals in YAML/JSON/compose files
  - Base64-encoded high-entropy strings that decode to credentials
- If a secret is ever committed, assume it is compromised and rotate it immediately.

## Operational data

- Keep cluster state, pod lists, and service endpoints out of Git.
- Store deployment-specific values (hostnames, IPs, certificates) in external config/secrets stores, not in tracked manifests.

## Verification

- Run `git status` before committing and review every new file.
- Use tools like `git-secrets`, `truffleHog`, or `gitleaks` in CI to block commits containing credentials.
