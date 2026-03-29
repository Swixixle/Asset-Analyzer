# Billing gate checklist

Do not set DEBRIEF_BILLING_ACTIVE=1 in any environment until every item below is checked.

- [ ] Stripe webhook endpoint verified end-to-end in staging
- [ ] Credit deduction logic tested with real Stripe test-mode charge
- [ ] Free tier limits enforced and tested (rate limiting, credit floor)
- [ ] Clerk + billing integration confirmed (user identity maps to credit account)
- [ ] API key (dk_*) billing enforcement confirmed on /api/v1 routes
- [ ] Overage behavior defined and tested (reject request or queue it — pick one)
- [ ] DEBRIEF_BILLING_ACTIVE=0 confirmed as default in render.yaml
- [ ] All billing routes confirmed behind auth — no anonymous billing endpoints
- [ ] Legal review of pricing copy complete (no unintended price commitments in UI)
