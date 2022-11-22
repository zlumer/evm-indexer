# EVM Indexer

# ‼️ This is an alpha version, not suitable for production ‼️

If you want to use this in your dApp, please contact me first and I'll try to help as much as I can.

Email: `[my github username]@gmail.com` or Telegram: [`@zlumer`](https://zlumer.t.me/)

## Motivation

EVM Indexer is a tool for indexing Ethereum blockchain data in a database. It's designed to be used in dApps that need to query blockchain data.

### EVM Indexer goals

- **Easy to use** --- easy to set up and use even for an inexperienced developer.
- **Fast** --- fast enough to be used in DeFi dApps where money is at stake.
- **Open source** --- open source and free to use.
- **Cheap to run** --- possible to run on a $5 VPS for lightweight smart contracts.
- **Flexible** --- usable in all sorts of different dApps, from DeFi to GameFi to NFTs etc.
- **Production-ready** --- while DX is important, it's not the only thing. The tool should be production-ready and stable.

## Features

- GraphQL API
- Webserver with GraphQL Playground
- Webhooks
- Handles re-orgs automatically
- Flexible data model
- TODO: Codegen
- TODO: CLI tool with one-line dev mode
- TODO: Production DB migration

## Roadmap to v1.0

#### Complete

- [x] Support multiple EVM chains
- [x] GraphQL API (via Postgraphile)
- [x] Sync process reporting (% done, time passed, time remaining) -- logs only
- [x] Webhooks (naive implementation)
- [x] NPM package & CI/CD
- [x] Handlers & events generation from ABI

#### In progress

- [ ] Basic documentation (README, quickstart)
- [ ] DB hot migration (without restart)

#### TODO

- [ ] Event congestion rollback & batch size correction
- [ ] Data model codegen
- [ ] Data model versioning
- [ ] Handlers & webhooks versioning
- [ ] Block-based indexing (not just events)
- [ ] Filters (events by topic, events by address, blocks by events (+ topics, addresses))
- [ ] Documentation (API docs, examples)

## Getting started

### Installation

```sh
yarn add evm-indexer
```

### ~~Quickstart~~ (not implemented yet)

1. Add `evm-indexer` package to your hardhat project
2. ~~Run `yarn evm-indexer --dev` (or `npx evm-indexer --dev`)~~ (not implemented yet)
3. ~~All ABI files will be watched and typings generated and re-generated automatically~~
4. All events will be indexed and stored in the DB
5. GraphQL API will be available at `http://localhost:3000/graphql`
6. ~~Describe your data model in `evm-indexer.yaml` (see [example]())~~
7. Add some handlers ~~(see [example]())~~
8. Add some webhooks ~~(see [example]())~~

If using VSCode, after ABI or data model definition file changes you might need to restart your TypeScript server to get autocompletion. You can do this by pressing `F1` (or `Ctrl+P`) and running `TypeScript: Restart TS server` command.

## Configuration

### Data model definition

## Why?

#### Up-to-date state access

#### Historical events

#### Lower gas usage

You don't need `indexed` event params anymore --- you can always access them through the indexer.

