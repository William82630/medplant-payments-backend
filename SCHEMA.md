# Supabase Schema Notes

## user_subscriptions

### CHECK Constraints

The `plan` column has a CHECK constraint: `user_subscriptions_plan_check`

**Allowed values:**
- `free`
- `pro_basic`
- `pro_unlimited`
- `pro_unlimited_yearly`
- `pay_per_scan`

### ⚠️ Adding a New Plan

If you add a NEW plan to the system, you MUST update **THREE places**:

1. **Supabase CHECK constraint** (SQL Editor):
```sql
ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_plan_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_plan_check
  CHECK (plan IN ('free', 'pro_basic', 'pro_unlimited', 'pro_unlimited_yearly', 'pay_per_scan', 'NEW_PLAN_HERE'));
```

2. **Backend `VALID_PLANS` array** in `api/payment-redirect.ts`

3. **Mobile app** — update all plan checks (`SubscriptionService.ts`, `ProfileService.ts`, `PlansAndPricingScreen.tsx`, `MyAccountScreen.tsx`, `SettingsScreen.tsx`)

### Key Columns
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Unique, FK to auth.users |
| `plan` | text | CHECK constrained (see above) |
| `is_pro` | bool | Whether user has active pro subscription |
| `daily_credits` | int4 | Remaining credits (also used as balance for pay-per-scan) |
| `last_reset_date` | date | For daily credit reset logic |
| `subscription_id` | text | Razorpay payment ID |
| `plan_start_date` | timestamptz | When subscription started |
| `plan_end_date` | timestamptz | When subscription expires |
| `updated_at` | timestamptz | Last update timestamp |
