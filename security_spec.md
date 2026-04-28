# Security Specification: SurveyGo

## 1. Data Invariants
- **User Profiles**: Every user must have a profile. A user can only create their own profile. Once created, only an admin can change a user's role or status.
- **Orders**: Only clients can create orders. Only the assigned surveyor can update an order's status to 'on_site' or 'completed'.
- **Notifications**: Users can only read their own notifications.
- **Survey Types**: Publicly readable, but only writeable by admins.

## 2. The "Dirty Dozen" Payloads (Deny Cases)

### User Profile Attacks
1. **Admin Spoof (Create)**: `setDoc(users/attacker, { role: 'admin', status: 'active', ... })` -> Should fail unless they are actually authorized.
2. **Role Escalation (Update)**: `updateDoc(users/victim, { role: 'admin' })` -> Should fail for non-admins.
3. **Identity Theft (Create)**: `setDoc(users/victim, { ... })` -> Attacker trying to create someone else's profile.
4. **Status Hijack**: `updateDoc(users/attacker, { status: 'active' })` -> Suspended user trying to reactivate themselves.

### Order Attacks
5. **Price Manipulation**: `addDoc(orders, { price: 100, ... })` -> Client setting a lower price than calculated (though rules currently don't verify price vs basePrice, they should check role).
6. **Double Assign**: `updateDoc(orders/id, { surveyorId: 'new_surveyor' })` -> Someone stealing a job already assigned.
7. **Fake Completion**: `updateDoc(orders/id, { status: 'completed' })` -> Client marking their own job as done.
8. **Rating Spoof**: `updateDoc(orders/id, { rating: 5, review: 'Great!' })` -> Surveyor rating themselves.

### Resource Attacks
9. **Notification Scraping**: `getDocs(users/target/notifications)` -> Reading someone else's messages.
10. **ID Poisoning**: `setDoc(users/VERY_LONG_GARBAGE_ID_..., { ... })` -> Resource exhaustion attack.
11. **Shadow Field Injection**: `setDoc(users/me, { ..., isVerified: true })` -> Injecting fields not in schema.
12. **Status Shortcutting**: `updateDoc(orders/id, { status: 'completed' })` skipping 'assigned' and 'on_site'.

## 3. Test Runner Concept (Conceptual firestore.rules.test.ts)
```typescript
// Conceptual tests
describe('User Profile', () => {
  it('prevents creating a profile for someone else', async () => {
    const db = getTestEnv().authenticated('attacker');
    await assertFails(setDoc(doc(db, 'users', 'victim'), { role: 'client' }));
  });

  it('prevents updating role', async () => {
    const db = getTestEnv().authenticated('user');
    await assertFails(updateDoc(doc(db, 'users', 'user'), { role: 'admin' }));
  });
});
```
