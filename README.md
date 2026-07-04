# soursop — SOL Trading Bot for Telegram

A production-ready Telegram bot for trading on Solana with zero fees via Jupiter Aggregator.

## Features

- **Wallet Management**: Generate, import (mnemonic / base58 / hex / array), and store wallets encrypted with AES-256-GCM
- **Token Swaps**: Buy any SPL token via Jupiter (quote → instructions → execute)
- **Portfolio**: View all wallets and their SOL balances
- **Live Prices**: Background CoinGecko price fetcher → Redis cache → Kafka events
- **Settings**: Per-user slippage tolerance and default wallet selection
- **Secure**: Private keys encrypted at rest; mnemonic auto-deleted after 60s

## Commands

| Command     | Description                               |
| ----------- | ----------------------------------------- |
| `/start`    | Welcome message                           |
| `/help`     | Show all commands                         |
| `/generate` | Create a new Solana wallet                |
| `/import`   | Import wallet via mnemonic or private key |
| `/balance`  | Check SOL balance of your wallets         |
| `/buy`      | Buy any token (wizard)                    |
| `/sell`     | Sell tokens you hold (wizard)             |
| `/wallets`  | List all your wallets                     |
| `/settings` | Configure slippage & default wallet       |

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and fill in your env
cp .env.example .env
# Edit .env with your BOT_TOKEN, PASSWORD, RPC_URL

# Run in development
pnpm dev
```

### Docker Compose (Production)

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

## Architecture

```
Telegram User → Telegraf Bot → Scenes.Wizard (buy/sell)
                                  ↓
                    Solana RPC  ←  WalletManager (encrypted MongoDB)
                    Jupiter API ←  Swap Engine (cross-fetch)
                    CoinGecko   →  Redis (price cache) → Kafka (events)
```

### Stack

- **Runtime**: Node.js 22 + TypeScript
- **Bot Framework**: Telegraf (Telegram)
- **Solana SDK**: @solana/kit v2
- **Swap**: Jupiter Aggregator (v1 lite API)
- **Database**: MongoDB + Mongoose / Typegoose
- **Cache**: Redis (sessions + price cache)
- **Events**: Kafka (price update stream)
- **Logging**: Pino
- **Encryption**: AES-256-GCM with scrypt key derivation

## Development

```bash
pnpm test              # Run tests
pnpm test:coverage     # With coverage
pnpm build             # Compile TypeScript
pnpm start             # Run compiled JS
```

## Environment Variables

See `.env.example` for all required variables.
