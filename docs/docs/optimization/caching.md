---
slug: /optimization/caching
title: Caching Strategy Guide
sidebar_position: 61
---

# Caching Strategy Guide

This page summarizes a practical multi-tier caching approach used in Gatrix.

## Architecture

- L1: in-memory (per-instance)
- L2: Redis cluster (shared)

## Patterns

- Cache-aside for read-heavy workloads
- Explicit invalidation on writes (key pattern-based where needed)

## Keys

- Use explicit, deterministic keys: `gatrix:<type>:<identifier>:<sorted-params>`

## TTLs

- Choose TTLs per data type (hot paths shorter; configs longer)

## Error Handling

- Degrade gracefully on Redis errors; never block core paths

## Next

- See database optimization: [/docs/optimization/database](/docs/optimization/database)

