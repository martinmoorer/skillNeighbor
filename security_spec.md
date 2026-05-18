# Security Specification - SkillNeighbor

## Data Invariants
1. A `SkillPost` must have an `authorId` matching the authenticated user's UID.
2. A `TradeRequest` cannot be created by a user to themselves (senderId != receiverId).
3. Only the recipient of a `TradeRequest` can change its status to 'accepted' or 'rejected'.
4. User profiles can only be modified by the owner.
5. All IDs must follow standard alphanumeric patterns.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Malicious UID Setting**: Attempting to create a user profile with a UID different from the auth token.
2. **Shadow Field Injection**: Adding an `isAdmin` field to a user profile update.
3. **Skill Post Hijacking**: Updating a `SkillPost` that belongs to another user.
4. **Anonymous Posting**: Attempting to create a `SkillPost` without being signed in.
5. **Trade Request Spoofing**: Creating a `TradeRequest` where `senderId` is someone else's UID.
6. **Self-Trading**: Creating a `TradeRequest` where `senderId == receiverId`.
7. **Bypassing State Isolation**: A sender attempting to mark a `TradeRequest` as 'accepted'.
8. **Resource Exhaustion**: Sending a `SkillPost` with a 1MB `description` string.
9. **ID Poisoning**: Using a `postId` that is 500 characters long with emoji.
10. **Time Traveling**: Setting a `createdAt` date in the future (client-side timestamp instead of server timestamp).
11. **Outcome Manipulation**: Updating a 'completed' trade back to 'pending'.
12. **PII Blanket Read**: Trying to list all users' private emails (if we had a private field).

## Test Runner Logic
The `firestore.rules` will be verified against these scenarios using `isValid[Entity]` helpers and strict `affectedKeys()` checks.
