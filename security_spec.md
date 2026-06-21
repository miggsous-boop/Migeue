# Security Specifications: Inventory Control System

This document outlines the security architecture, invariants, and threat vectors analyzed for the "Gerenciador de Estoque" (Team Inventory Manager) application.

## 1. Data Invariants

1. **Product SKU ID Integrity**: A Product's document ID must match its `id` fields. It must consist solely of alphanumeric characters, hyphens, and underscores, preventing directory traversal or path poisoning.
2. **Non-Negative Stock & Price**: Product `quantity`, `minQuantity`, and `price` must navigate strictly non-negative bounds (`>= 0`).
3. **Transaction Immutability**: All transaction history logs are absolute. Once written, they can never be modified or deleted. Only `create` and `read` access are permitted.
4. **Historical Actor Alignment**: The `userId`, `userEmail`, and `userDisplayName` fields in any product modification or logged transaction must align with the current authenticated `request.auth` actor.
5. **No Orphaned Transactions**: Creation of transaction history logs requires that the references product must exist or have existed in the system.
6. **Temporal Alignment**: Create/Update actions must align with `request.time` server timestamps.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads attempt to breach security bounds and must be blocked:

1. **Payload 1: Unauthenticated Product Creation** - Attacker tries to inject a product without signing in.
2. **Payload 2: SKU Path Mismatch** - Attempting to write a product under `/products/apple` but with an internal ID of `"orange"`.
3. **Payload 3: ID Poisoning** - SKU contains invalid characters like `/../secrets` or massive size to trigger exhaustion.
4. **Payload 4: Negative Stock Injection** - Injecting a product with `quantity: -42`.
5. **Payload 5: Negative Price Injection** - Injecting a high-value product with `price: -100` to break calculation filters.
6. **Payload 6: Email Spoofing on Action** - User attempts to claim `updatedByEmail: "admin@company.com"` when their actual auth token email is different.
7. **Payload 7: Client-side Timestamp Manipulation** - Attempting to set `updatedAt` to a future date instead of the server's `request.time`.
8. **Payload 8: Transaction State Shortcut** - Trying to update or erase a completed audit transaction record under `/transactions/{txId}`.
9. **Payload 9: Actor Impersonation in Logs** - Setting a transaction's `userId` to a target team leader's UID while signing in with a standard UID.
10. **Payload 10: Under-sized Key Schema** - Sending an incomplete product object missing mandatory fields (`name` or `category`).
11. **Payload 11: Extra Ghost Fields** - Attempting an update/create containing a hidden payload `isAdmin: true` or `isVerified: true` (Shadow field block).
12. **Payload 12: Invalid Transaction Type** - Creating an audit log with type `"THEFT"` instead of the strict enum `["IN", "OUT", "ADJUST"]`.

---

## 3. Test Cases (TDD Rules Validation)

Below is an abstract of the test configuration designed to return `PERMISSION_DENIED` on all malicious edits.

```typescript
// firestore.rules.test.ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

// All operations that attempt these payloads will be tested against the security rule validation engine.
// They will fail because firestore.rules establishes:
// 1. Strict key checks (hasAll + size bounds).
// 2. Exact match of request.auth.uid with user references (updatedBy, userId).
// 3. Immutability of transactions (allow read, create; but deny update, delete).
// 4. Temporal alignment check (createdAt/updatedAt == request.time).
```
