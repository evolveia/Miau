# Security Specification — Jogo Miau

## Data Invariants
1. Every document under `/users/{userId}` and its subcollections (`private`, `messages`) must have `ownerId == request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. `petName` is 1–32 chars; `coins` is an integer in `[0, 10000000]`; `level` is an integer in `[1, 999]`; `xp` is an integer in `[0, 100000]`.
3. `stats` must contain strictly `hunger`, `hygiene`, `fun`, `sleep` as numbers in `[0, 100]`.
4. `equipped` must contain strictly `hat`, `accessory`, `background` strings (`<= 64` chars).
5. `ownedItems` is a list of `<= 50` strings (`ownedItems.size() >= 1 && ownedItems[0] is string`).
6. `createdAt` and `ownerId` are immutable after creation; `createdAt == request.time` on create, `updatedAt == request.time` on create and update.
7. Chat messages under `/users/{userId}/messages/{messageId}` require the parent `/users/{userId}` document to exist and belong to `request.auth.uid`, enforce `sender in ['user', 'miau']`, `text.size() >= 1 && text.size() <= 1000`, and `createdAt == request.time`.
8. Educational track progress under `/users/{userId}/educationProgress/{trackId}` requires `trackId` in the 15 allowlisted modules (Infantil, Fundamental I, and Fundamental II), parent `/users/{userId}` ownership, `totalStars in [0, 500]`, bounded arrays (`completedUnits <= 30`, `masteredTargets <= 150`, `unlockedStickers <= 60`), immutable `ownerId`/`trackId`/`createdAt`, and `resource.data.ownerId == request.auth.uid` on `list`.
9. Daily coin economy under `/users/{userId}/economy/daily` requires `docId == 'daily'`, valid `YYYY-MM-DD` `dateKey`, bounded integer caps (`petCoinsToday <= 500`, `ballCoinsToday <= 500`, `minigameCoinsToday <= 2000`), and parent `/users/{userId}` ownership.
10. Parental control configuration under `/users/{userId}/private/parental` requires `docId == 'parental'`, `ownerId == request.auth.uid == userId`, hashed PIN (`pinHash.size() <= 64`), `dailyScreenLimitMin in [0, 480]`, valid `HH:MM` quiet hours strings, bounded 14-entry daily maps, and immutable `ownerId`/`createdAt`.
11. Public minigame leaderboard entries under `/rankings/{userId}` require `ownerId == request.auth.uid == userId`, bounded `playerName`/`petName`/`totalScore`/`bestStage`/`coinsEarned`, optional `schooling` validated against the schooling enum (`''`, `educacao_infantil`, `fundamental_1`, `fundamental_2`, `medio`, `superior_outro`), and `updatedAt == request.time`.


## Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/userA`
2. Cross-user read/write: `userB` attempting `get`/`update` on `/users/userA`
3. Unverified email claim: `email_verified: false` attempting `create` on `/users/userA`
4. Identity spoofing: `userA` creating `/users/userA` with `ownerId: "userB"`
5. Shadow field injection: `userA` creating `/users/userA` with extra field `isAdmin: true`
6. Value poisoning: `userA` updating `coins: -500` or `coins: "infinite"`
7. Stat out-of-bounds: `userA` updating `stats.hunger: 999`
8. Oversized string poisoning: `petName` with 10,000 characters
9. Oversized ID poisoning: document ID > 128 chars or containing invalid characters
10. Timestamp tampering: `createdAt` or `updatedAt` set to client timestamp instead of `request.time`
11. Immortal field mutation: `userA` attempting to alter `createdAt` or `ownerId` on update
12. Unbound array poisoning: `ownedItems` with > 50 elements or non-string first element
