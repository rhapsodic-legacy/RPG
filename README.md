# RPG — 3v3 personality auto-battler

Fighters with vectorised personalities, memories and relationships live together in a
house and brawl in 3v3 arenas. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full design.

## Status

Milestone 2 (first pass): a deterministic, headless **social simulation** — memory stream,
retrieval, nightly reflection into beliefs, directed relationships, gossip, jealousy,
apologies, open threads → focus → fight readiness — with swappable cognition providers
ready for LLM-driven minds.

Milestone 1 (first pass): a deterministic headless **1v1 arena** where contact is decided by
body geometry and stance, choices by personality and learned experience, and reactions by
how focused the fighter is after their week at home.

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
npm run sim -- --journal martha --inbox   # read a journal and the manager's inbox
npm run sim -- --days 7 --rhythm          # daily rhythms: where everyone spends time, who talks to whom
npm run sim -- --days 6 --talks martha    # journal lines with the recorded conversations behind them

npm run fight -- --a brick --b shell --log        # sparring gym, play-by-play
npm run fight -- --a duke --b shell --rounds 4    # watch learning across fights
npm run fight -- --scenario love-triangle --days 14 --a bob --b jin   # after two weeks of drama

npm run match                     # 3v3 "Night of Rivals": inbox, pre-fight talk, fight, aftermath
npm run match -- --leader martha  # same night, different leader (or --leader none)

npm run replay                    # build arena-replay.html: 2.5D replays of exported fights
```

In the love-triangle scenario only one thing is scripted: Bob gets injured on day 2.
The breakup, the new couple, the gossip, the feud, the brawls and Martha's distraction
all emerge from the rules.
