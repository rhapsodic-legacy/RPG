# Handoff — where the project stands and how to keep going

Read this first when picking the work back up. `docs/DESIGN.md` is the full design; this
file is the working memory: the owner's rules, what exists, how it fits together, what's
next, and the gotchas.

---

## 1. The owner's rules (non-negotiable — learned the hard way)

These came directly from the project owner across several rounds. Violating them is the
most common way to get work rejected.

1. **No invisible hand.** Nothing lasting decays, heals, drifts or resets on a timer:
   not resentment, attraction, beliefs, threads, temperament or mood. Thoughts, memories and
   feelings stick with a fighter *until resolved, changed or counteracted*, like with humans.
   Feelings change only through other feelings (`feel()` in `emotion.ts`: gratitude and
   affection counteract anger, joy counteracts sadness, etc.). Physiology (hunger, energy,
   injury recovery) is the only thing on the clock. Unresolved threads resurface nightly
   (rumination) — the owner explicitly wants that.
2. **No hard-baked behavioural rules.** No captain mechanic, no "one fight per encounter",
   no obedience rule, no cooldown-as-psychology. Behaviour comes from weighted pulls:
   personality, relationships, memories, beliefs, needs, what was said and how much the
   listener heeds the speaker. "Think about how humans do things." Leaders lead the way
   their personality leads (Bob dictates, Martha strategises, Jin gives a pep talk, an
   incompetent leader rambles).
3. **Pacing limits are commented out, not deleted.** In `cognition/rules/interaction.ts`
   (`consider` / `_pacing`) and the sparring cap in `sim/simulation.ts`. The owner wants to
   watch behaviour grow unbounded first, then decide which limits are needed and how.
   Two tests that depended on them are `it.skip` with a comment.
4. **Personality is the only randomness.** The sim is deterministic: no RNG in decisions,
   no dice in combat (contact quality is pure geometry). Same scenario + journal ⇒ same
   state hash. Avoid `Math.pow/exp/sin` in sim code (use `powi`, `Math.sqrt` is fine).
5. **LLM-ready from day one.** Every cognitive act is a swappable provider
   (`cognition/providers.ts`, `combat/policy.ts`, `combat/tactics.ts`, `combat/talk.ts`).
   Non-deterministic minds act only through **journaled inputs** (e.g. `coach_utterance`
   with an `interpretation`, `intent`). Raw text is always kept. `buildMindContext()`
   exports grounded, prompt-ready state. The sim stays the source of truth.
6. **Difficult and dramatic by design** ("like The Bachelor"). Relationships are hard to
   manage; neglect is punished (fighters will be able to leave permanently); the player has
   many levers (house layout, gifts, talking, manipulation, match choice). A FUBAR scenario
   *should* blow up.
7. **Fighters must be distinct** (The Bouncer): different movement, stances, striking, not
   just stats. Identical fighters should be near impossible once styles/progression exist.

8. **Stop fixing things the owner hasn't flagged.** Once the app exists, the owner wants
   to play it and tweak behaviour themselves ("instead of you smashing issues that may
   not be an issue"). Fix what they report; surface oddities as notes, don't retune them.
   The Bob/Jin/Martha triangle and Suzie Q are just two of countless possible stories,
   so don't tune the sim to one scenario.
9. **It's a phone app played once a day.** The player logs in, does a title fight, reads
   journals and emails, and intervenes. Because the player intervenes constantly, the
   no-intervention CLI runs overstate how fast things blow up. **Real-time pacing: one human
   day is one sim day** (48 ticks of 30 min, one tick every 30 real minutes). A dev speed
   multiplier is fine for testing.
10. **The feel the owner is aiming for:** "The fighting part is the high octane. The house
    part is the highly entertaining part… watching my fighters take down a stronger team
    is something I'll never forget. Watching all the women email me because Kai was spying
    on them while they bathed in the pool… I'm still laughing. And I told Kai to keep doing
    it." It should feel unlike any other hero collector.

## 2. Workflow

- Branch: `claude/eager-cray-xou2wj`. Commit with clear messages; push with
  `git push -u origin claude/eager-cray-xou2wj`. Don't open PRs unless asked.
- Commit trailer (required):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01B5t9RB7PZPFv68jfpuSgEV
  ```
- Before pushing: `npm run typecheck` (strict, noUnusedLocals) and `npm test`.
- Use they/them for the owner. Fighters are named characters; avoid gendered pronouns in
  generated text templates (use names).
- The owner reads output in chat; keep summaries plain, show emergent stories (CLI output)
  rather than describing mechanisms.

## 3. Commands

```sh
npm install
npm test / npm run typecheck
npm run sim [-- --days 21 --kitchens 2 --compare --verbose --journal martha --inbox --inspect bob]
npm run sim -- --days 7 --rhythm          # where everyone spends their time, who talks to whom
npm run sim -- --days 6 --talks martha    # journal lines with the recorded conversations behind them
npm run sim -- --scenario suzie --days 7 --journal suzie --journal kai --inbox   # Suzie Q moves in
npm run sim -- --scenario suzie --days 7 --room suzie=bed_kai@3                   # manager moves her into Kai's room on day 3
npm run fight [-- --a brick --b shell --log --rounds 4 --scenario love-triangle --days 14]
npm run match [-- --leader martha|jin|none]     # 3v3 Night of Rivals end-to-end
npm run replay                                   # builds arena-replay.html (2.5D viewer)
```

Published replay viewer artifact: https://claude.ai/artifact/CGfo7EAt5A4MXJB4AuDdTc
(republish by rebuilding `arena-replay.html` and publishing the same file path in-session,
or pass that URL as `url` from a new session).

## 4. Architecture

TypeScript monorepo (npm workspaces, Node 22, Vitest, tsx). `packages/sim-core` is the
deterministic engine; `packages/sim-headless` holds CLIs and the replay viewer.

```
sim-core/src/
  types.ts            all state types (SimState is plain JSON: hashable, snapshot-able)
  world.ts            getFighter (house + outsiders), relationships, labels, helpers
  temperament.ts      10 axes incl. pragmatism; traits; compatibility
  emotion.ts          emotion vectors; feel() = add + counteract (no decay)
  time.ts             30-min ticks, meals, sleep, nightly slot (02:00)
  home/routine.ts     chronotype (own bedtime/peak hours), pastimes (derived from temperament
                      if not given)
  sim/conversation.ts topics (news / feelings / shared pastime), engagement (appetite for
                      company × who it's with + something to say), WILLING_TO_TALK
  mind/memory.ts      memory stream, Smallville retrieval, GOSSIP_WORTHY, pruning (capacity)
  mind/threads.ts     open threads → preoccupation → focus → readiness
  mind/teams.ts       teammateRefusals ("won't fight with Jin or Martha")
  cognition/providers.ts   provider interfaces (+ determinism contract)
  cognition/context.ts     buildMindContext / renderMindContext (LLM prompt context)
  cognition/rules/*        rule-based providers: appraiser, activity, interaction
                           (confront/apologise/gossip/flirt…), reflector, utterance,
                           narrator, voice (Diarist + Correspondent)
  sim/simulation.ts   Simulation.step(): inputs → scheduled fights → statuses → plan&move
                      → needs → meals → sparring → socialize → perceive → nightly
  sim/perception.ts   integrate(): appraisal → relationship deltas, feelings, memories,
                      grievance tags; gossip propagation; voicing grievances
  sim/inputs.ts       Input union (injure, coach_utterance, intent, schedule_fight,
                      set_leader, set_cooks) + journal
  sim/scenario.ts     Scenario → SimState (makeFighter, outsiders, records, upcoming)
  combat/             body geometry, moves, knowledge (learning), policy (move choice,
                      hover), tactics (who to fight), talk (pre-fight speech + heed),
                      records (public fight record, perceivedEdge), fight (N-v-N engine,
                      optional trace)
  scenarios/          love-triangle, sparring (Brick/Shell/Wren/Duke), rival-night (3v3)
```

Key mechanics in one line each:
- **Appraisal**: same event, different feelings by temperament, role and relationships
  (jealousy via romantic triads; a crush can't blame an established couple like an ex can).
- **Knowledge is local**: witnesses vs told (gossip, confidence < 1) vs inferred (beliefs).
- **Grievances**: memories tagged `grievance:X`; confronting X voices them (`addressed`);
  resentment stays. Confrontation is a chosen interaction; target walks away / argues /
  fights back. Apologies limited by memory of having made amends.
- **Threads**: feud, heartbreak, caught_in_middle, guilt (until apology accepted).
- **Voices**: nightly journal entries; manager inbox (refusals, intervention requests with
  suggestions, food complaints, "let me lead" requests). Topics deduped via `raisedTopics`.
- **Arena**: contact from geometry (height bands × stance × reach tip); guards by stance;
  throws fail on heavy/braced; learning per move × opponent stance, threat learning;
  curiosity explores; impatience; focus → reaction delay, missed openings, misjudged range.
- **Teams**: pre-fight SpeechActs (claim/assign/priority/pep/nonsense/taunt) → influences
  weighted by `heed()`; tactics weighs grudge, perceived/live matchup, protect (with
  foresight), finish, glory, fear, distance, commitment, told-to (discounted by
  credibility). Hover mode = wanting a claimed opponent while holding back.
- **Conversations** are joint activities: opened only if talking beats what the opener is
  doing (`engrossed`), accepted only if it beats what the other is doing (else a remembered
  brush-off), continued each half hour only while both still choose 'talk' over everything
  else. Company satisfies (social need fills only through conversation); topics run out
  (`told`); brush-offs and romantic rejections are remembered and dampen retries. Turns are
  recorded; `state.dialogue` keeps 3 days (DIALOGUE_DAYS); journal entries carry `refs`.
  Couples' time together shows as public affection. Asking out goes only to the one you want
  most, and the asked person decides (`acceptsAdvance`).
- **Routines**: per-fighter bedtimes, peak training hours, pastimes in rooms with amenities
  (books/music go anywhere), shared pastimes and sparring quietly build closeness; room
  choice is pulled by who's expected there (the bookworm reads where their crush plays pool).
- **Attraction & Maslow** (`home/attraction.ts`): `appeal(from,to)` is directional — looks
  (attractiveness + "my type": hair, colour, style, build) weighted by how much looks matter
  to them, plus character (confidence, kindness, status = wins on record, attention =
  familiarity). It's the ceiling attraction grows toward; first sight gives a spark
  (`first_impression`, "Met X today. Wow."). Needs gain `intimacy` and `esteem`; `desire`
  and `ambition` only drive behaviour once the body (food, rest) is settled, and ambition
  once belonging is. Ego-heavy Bob trains for his streak; romantic Jin chases.
  Showing off / flirting feed the target's esteem; witnesses feel jealousy (triads) or envy.
  Rejected advances after flirting read as being teased. Fighters refuse scheduled fights
  where they're badly outclassed (`refusesFight` → 'outclassed', email to the manager).
  Recruits come off the gym board via `generateFighter(seed)` (deterministic).
- **Loop**: scheduled fights run inside `step()`; record + speech/rescue/knockout/
  match_result events + injuries flow into memories, journals and relationships.

## 5. Current state of behaviour (honest)

- Love triangle (21 days) with conversations + routines: ~3 conversations a day across the
  house (~30–60 min each); Martha journals "I have strong feelings for Jin now… I hope Bob is
  ok with that" while Bob is in the infirmary; Martha and Jin bond over TV evenings and
  sparring; breakup ~day 7, Jin and Martha together; Jin ("I feel terrible about Bob") and
  Martha both apologise, Bob accepts but writes "I won't fight on a team with Jin or Martha.
  It hurts too much." Calmer than the old constant-chatter version (no brawls).
- Suzie Q (7 days, 10 fighters + Suzie recruited day 2): Kai "Met Suzie Q today. Wow…
  I can't stop thinking about Suzie Q", asks her out, gets "No", calls her a tease; Suzie
  writes "Bob, Jin and Kai were all over me today. I love it here." and dates Bob; Martha
  "Everyone's falling over themselves for Suzie Q. I can't stand it." and brawls with her;
  Jin and Bob feud; Suzie emails she won't get in with Tank; Bob is knocked out by Tank.
  Moving Suzie into Kai's room (`--room suzie=bed_kai@3`) gets "Get Kai out of my room…
  or I don't know how much longer I can stay here" and, by day 5, blows.
  Weak spots: enemies share the single infirmary and keep arguing; lots of "caught in the
  middle" emails; no departures yet, so threats to leave are only words.
- Template dialogue is wooden and repetitive by design: the Conversationalist seam is where
  an LLM should write the words.
- Night of Rivals: Bob dictates, claims Sting; Sting taunts; Jin asks to lead by email;
  Bob loses to crouching Sting again; Jin finishes Vex then "Hang on, Bob!" too late;
  Bob's journal: "Jin jumped in for me against Sting. I didn't ask for that."
- Known weaknesses: 3v3 collapses into one central scrum; fighters look too alike in
  motion; mirrored trades between similar fighters; Ox overpowered; "didn't ask for that"
  uses resentment as a proxy for a claim; no mid-fight plan changes.

## 6. NOW: the playable app (owner's latest request, top priority)

The owner wants to run it on their computer or in the cloud, log in, set up fights, watch
the house and read the drama. Then they'll start tweaking. The visuals need to look decent,
not like stick figures. Everything below is a plan: none of it is built yet.

**Scope for the first playable build:**
- **Server:** a new `packages/server`. Node with `node:http` or a small framework.
  - Accounts: username and password hashed with scrypt, session cookie.
  - One world per player, persisted as JSON: the scenario seed plus the input journal is
    enough to replay, but a snapshot is faster.
  - A real-time clock advances the world to "now" on each request and on an interval. Catch
    up after downtime. Dev speed multiplier via env/admin.
  - The API exposes house state, fighters, journals, inbox and conversations (turns), and
    takes player inputs: assign bedroom, recruit, schedule fight, build room, later
    chat/lies/deals.
  - Fight results come back with traces for replay.
- **Client:** a new `packages/app` (Vite + TypeScript). three.js 0.186 and vite 8.3.5 are
  installable from the registry.
  - The house is a rendered 2.5D/isometric Sims-like view: rooms with furniture (beds, TV
    lounge, billiards, kitchen, gym, infirmary, later a pool). Fighters walk between rooms
    and show speech bubbles from live conversations (one tick lasts 30 real minutes, so
    bubbles can play out in real time). Click a fighter to see their card: looks, record,
    mood as observed, journal.
  - Characters must look decent. Suggested: low-poly 3D humanoids built procedurally from
    `def.looks` (hair shape and colour, clothing style, skin) and `def.body` (height,
    mass), with lighting and shadows. Alternatively, well-shaded layered 2D. No external
    art assets exist.
  - Screens: login · house · roster/fighter cards · journals (lines link to recorded
    conversations) · inbox (emails to the manager) · fights (pick 3, a leader and an
    opponent team; watch the replay rendered in 2.5D with the same characters; the "title
    fight" is the daily highlight) · recruit board · build/assign rooms.
  - The player must never see hidden truth such as temperament (see `SUZIE_Q`'s comment:
    "the player never sees this — only what she does").
  - Fight replay: `FightResult.trace` (`TraceSample`: x, z, stance, action, move, t, hp,
    target, mode, out) plus `events`. See `sim-headless/src/export-fights.ts` and
    `replay/viewer.template.html` for the existing 2D viewer to port.
- **New-game state:** a basic home base (a few rooms) and a random starting roster of
  **5 fighters** from `generateFighter(seed)`. There's no roster cap. More fighters need
  housing and feeding, they squabble, and they want fights to earn rep. Benched fighters
  eventually get up to no good (annoying things, leaving). The home base can be built out
  a lot (room catalog; Kai and the pool is the canonical joke).
- Deploy notes for cloud and local in the README: `npm run app` serves both.

**Later (owner, "down the road"):** trading fighters with other teams, in PvE and PvP.
Also money and rep economy, departures, and the earlier list below.

**Latest sim change:** throwing the first punch now needs nerve and is restrained by
attraction and fear (`strikesFirst`), so Kai never brawls with Suzie. Noted but left alone
for the owner to judge: a jealous Kai still swings at Bob, who is 36 kg heavier and dating
Suzie.

## 6b. Earlier next steps (owner agreed to all, after the app)

1. ✅ **Conversations that take time + personal daily rhythms** (first pass done). Follow-ups:
   group conversations (3+), a "dialogue day" save/load beyond 3 days, better reply logic.
   - Why 90+/day: 30-min ticks, every awake fighter picks the best interaction above a low
     bar each tick, chats are instantaneous and never satisfy anyone.
   - Make conversations multi-turn activities that occupy both people for a duration and
     end when someone has had enough (social need met, nothing left to say, something else
     calls). Record turns so a day of dialogue can be replayed later (journal line → scene).
   - Personal cadence (Sims-inspired): preferred activities and times (morning trainers,
     night owls, TV, reading, chatterboxes who haunt the kitchen), favourite places, and
     relationship pulls on location choice (Sally the bookworm starts reading near the
     billiards room where Bob spends his free time).
2. **Situational awareness / team foresight in fights**: spacing, flanks, not piling into
   one scrum; pre-fight matchup suggestions (Jin: "Martha, take Tommy — he mirrors me");
   teammates privately ganging up on Sting because they know Bob will fold, each weighing
   their own risk.
3. **Fighter progression and distinct styles**: stats, fighting styles (traditional karate,
   brawler…), unlockable moves, distinct movement/stances/strike animations (The Bouncer).
4. Player levers for the Suzie situation: conditional deals ("lead only if you keep your
   room to yourself"), lies (traceable), talking via the Conversationalist, gifts.
   Manager perception (multi-axis trust/affection/respect/fear from what fighters see the
   manager do), match types & stakes, permanent departures, traceable lies.
5. Rendered house view (Sims-inspired) in the replay viewer's style; recorded days.

## 7. Gotchas

- Event ids are `e<index>`; `state.events[Number(id.slice(1))]` is relied on.
- `getFighter` searches house then outsiders; `fighterIds/fighterList` are house only
  (the home sim only simulates house fighters).
- Nightly order: reflect → breakup → labels → prune; then threads/focus; then
  `afterThreads()` (rumination, sleep contentment, diary, correspondence).
- Diary entries are stamped to the previous day (written at 02:00).
- Combat `runFight` is a 1v1 wrapper over `runTeamFight`; team fights run 150s max.
- Emergent tests (`emergent.test.ts`, `voice.test.ts`, `team.test.ts`) encode stories;
  if tuning changes them, decide deliberately whether the story or the test should change.
