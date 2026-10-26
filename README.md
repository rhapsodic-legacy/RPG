# RPG — 3v3 personality auto-battler

Fighters with vectorised personalities, memories and relationships live together in a
house and brawl in 3v3 arenas. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Status

Milestone 2 (first pass): a deterministic, headless **social simulation** — memory stream,
retrieval, nightly reflection into beliefs, directed relationships, gossip, jealousy,
apologies, open threads → focus → fight readiness — with swappable cognition providers
ready for LLM-driven minds.

## Running

Requires Node 22+.

```sh
npm install
npm test            # unit + emergent-behaviour tests
npm run typecheck

npm run sim                       # 14-day love-triangle scenario, narrated
npm run sim -- --days 21 --kitchens 2
npm run sim -- --compare          # same fighters, one vs two kitchens
npm run sim -- --inspect bob      # print Bob's LLM-ready mind context
npm run sim -- --verbose          # every event, including chats and meals
```

In the love-triangle scenario only one thing is scripted: Bob gets injured on day 2.
The breakup, the new couple, the gossip, the feud, the brawls and Martha's distraction
all emerge from the rules.
