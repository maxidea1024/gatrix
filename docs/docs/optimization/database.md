---
slug: /optimization/database
title: Database Optimization Guide
sidebar_position: 60
---

# Database Optimization Guide

This page outlines practical tips for optimizing MySQL performance in Gatrix.

## Indexing

- Create selective single and composite indexes for hot queries
- Review query plans regularly using `EXPLAIN`

## Connection Pooling

Configure conservative but sufficient pool limits and timeouts (Knex):

```js
pool: {
  min: 2,
  max: 20,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 600000,
}
```

## Pagination

Prefer cursor-based pagination when feasible (use `id` or created timestamp).

## Observability

Track slow queries and collect latency metrics exposed via Prometheus.

## Next

- See caching strategies: [/docs/optimization/caching](/docs/optimization/caching)

