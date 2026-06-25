# Changelog

## v2.0.0 — 2026-06-25

### Dashboard — UI / Layout

- **Server chips** (TR/COM/NL/PT): height increased to 32px, border-radius 8px, bold font weight
- **Search input & Go button**: matched to 32px height for uniform toolbar alignment
- **Seviyeler dropdown**: matched to 32px height
- **Karakter button**: matched to 32px height, bold font
- **Obay, Dice (🎲), Stats (📊) buttons**: moved outside stats chip, circular 38px buttons, grouped after stats panel
- **Obay button** positioned last (rightmost) in button group
- **"Eklentiyi İndir" + Synch**: grouped into a single pill container styled like the language switcher
- **Online count text** removed from header (was showing "Online: X" causing layout shift and noise)
- **"Connect sent to X tab(s)." message** removed from status area
- **Server nickname cards**: nicknames centered within card (left label, centered nickname), yellow color
- **"TR" prefix** removed from server clock display
- **Table left/right edge padding** removed for full-width alignment
- **Eklentiyi İndir button** moved to nicknames-strip row alongside Synch

### Dashboard — Stats Panel

- **Header stats** (money, bank, bullets, health) now update correctly when switching servers — cache resets on server switch and re-fetches from correct server
- **Stats panel** always visible (`display:flex`), no longer pops in after connect (eliminated layout jump)
- **`selfProgression` fallback**: if dedicated field is null, finds own entry from `state.players` by clientId + serverId match
- **Server-side `findSelf`**: no longer falls back to first available entry when requested `serverId` has no match — returns `null` instead of wrong server's data

### Dashboard — Game Chat

- **Chat room labels**: "GENERAL (COM)" / "CRIMES (COM)" → just "COM" / "TR" (no redundant prefix)
- **Chat panel bottom toolbar** (Admin, Mesajlar, Hedefler, Notlar): moved outside `private-chat-main` into `private-panel-body` footer — no more overflow outside rounded box
- **Mesajlar button**: added 📬 emoji, height normalized to 26px matching Hedefler/Notlar
- **Hedefler/Notlar alignment**: fixed `margin-top: 4px` that was causing vertical misalignment

### Dashboard — Obay Panel

- **Stale data warning**: shows red "· stale" when Obay data is older than 5 minutes
- **All items showing "NOW" fix**: removed background fetch via `loadObayItemsViaFetch` (Knockout.js doesn't run in fetch+DOMParser context) — Obay data only updates from live game page
- **Absolute Unix timestamp support**: `data-time-end` values with 10+ digit timestamps handled directly
- **Language**: ŞİMDİ → NOW throughout Obay panel
- **`parseEndSeconds` fix**: removed `|| 999999` fallback that caused "11D 13H 45M" parse error

### Dashboard — Player Table

- **Own player data in General room**: own cooldowns and progression no longer censored (server-side `isOwnData` check)
- **Client-side censoring**: own row identified by `clientId` match, not just player name
- **General room public fields**: Heist, OC, MOC, Race cooldowns + Plating label + Rank visible to all; all other cooldowns censored for other players
- **Table flicker fix**: skips `innerHTML` update if content is unchanged

### Dashboard — Karakter Filter

- **Filter by clientId** (more reliable than player name string matching)
- **`myClientId` initialization**: set from first arriving identity event of any server (not just active server) — fixes filter not working before active server's SSE fires
- **`cachedSelfProgression` reset order**: fixed race condition where `renderPlayers(latestState)` was overwriting the null reset with old server's data

### Server (`server.js`)

- **`/api/state`**: `selfProgression` field added — returns own player's uncensored progression separately from player list
- **`/api/state`**: accepts `serverId` query param to match correct server entry for `selfProgression`
- **General room censoring**: `isOwnData` guard prevents own player's data from being censored in server response
- **Privacy endpoint**: `req` renamed to `_req` to silence unused-variable lint warning

### Extension (`content.js`)

- **Background Obay fetch removed**: `loadObayItemsViaFetch` block removed from `sendCooldownUpdate` — Obay data only sent from live game pages where Knockout.js is running
- **`data-time-end` attribute**: already read from `span[data-time-end]` for absolute Unix timestamp support
- **`myClientId` identity broadcast**: identity sent on any server tab, enabling dashboard to initialize `clientId` regardless of which tab fires first

---

## v1.0.0 — Initial Release

- Dashboard portal with multi-room portal chat, cooldown table, Obay tracker, game chat integration
- Chrome MV3 extension for Omerta TR/COM/NL/PT servers
- Room system with invite/join, member management, targets & notes panels
- Server-side cooldown state aggregation with SSE push
