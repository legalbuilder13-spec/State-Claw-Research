# Factual Baseline — What `<Company>` Does NOT Do

> **Operator: replace this with your specific list of operations the company
> does NOT perform.** This document is the negation of `fact-pattern.md`. The
> agent consults it before closing every analysis to catch "the agent's
> helpful elaboration drifted into something we don't actually do."

## Why this document is separate

A fact pattern describes what the company does. A factual baseline describes
what the company explicitly does NOT do. The negative space is just as
important as the positive — most classification errors creep in via a sentence
that subtly attributes an activity to the company that the company doesn't
actually perform.

This document is loaded into every run alongside `fact-pattern.md`. The Critic
sub-agent uses it to flag deliverable sentences that contradict the baseline.

---

## Generic placeholder (delete and replace)

`<Company>` does **NOT**:

### Employment / classification

- Employ, hire, retain, or otherwise enter into an employment relationship
  with `<Worker Type>` who use the platform.
- W-2 any `<Worker Type>`.
- Withhold taxes for `<Worker Type>` as if they were employees (1099 handling
  is for tax-reporting transparency, not employment indication).
- Jointly employ `<Worker Type>` with any customer or facility.
- Co-employ `<Worker Type>` with any customer or facility.
- Direct `<Worker Type>` in the manner, methods, or means of their work.
- Set work schedules for `<Worker Type>`. (Workers choose their own bookings.)
- Require `<Worker Type>` to work exclusively through the platform.
- Provide `<Worker Type>` with benefits, insurance, paid time off, or
  retirement contributions associated with an employment relationship.

### Training / supervision

- Provide professional training, clinical education, or continuing education
  to `<Worker Type>`. (Workers arrive at the platform already licensed and
  trained.)
- Supervise the performance of `<Worker Type>` once on a customer's site.
  (Supervision, where applicable to the engagement type, is exercised by the
  customer or the customer's licensed personnel.)
- Evaluate the performance of `<Worker Type>` in an employment-evaluation
  sense. (Customer feedback is a marketplace-integrity tool, not employment
  performance management.)
- Issue performance improvement plans (PIPs), corrective action, or
  disciplinary measures to `<Worker Type>`.
- Set clinical protocols, work procedures, or operational standards for the
  work `<Worker Type>` performs at customer sites.

### Customer / facility relationship

- Operate as a staffing agency, temporary services agency, or labor broker.
- Charge customers a direct-hire, conversion, or temp-to-perm fee if they
  hire a `<Worker Type>` they met through the platform.
- Place `<Worker Type>` with customers in an active-placement sense. (The
  platform is passive infrastructure — workers and customers find each other
  through it.)
- Send, dispatch, deploy, or assign `<Worker Type>` to customers.
- Guarantee customers that any specific `<Worker Type>` will be available
  or perform.

### Industry-specific (operator: add yours)

- `<Industry-specific operation the company does NOT perform>`
- `<Industry-specific operation the company does NOT perform>`
- `<Industry-specific operation the company does NOT perform>`

---

## How to write your real factual baseline

Replace the placeholder above with text answering:

1. **What activities does the company explicitly NOT perform** that are commonly
   associated with the type of business in your vertical? (E.g., a healthcare
   marketplace does not provide clinical training; a delivery marketplace does
   not set delivery routes; a home-services marketplace does not guarantee
   service quality.)

2. **What contractual representations does the company make about NOT doing
   things?** If your contracts represent that the company "does not supervise,
   direct, or control the work," that representation should be reflected here.

3. **What activities are sometimes proposed in negotiations that the company
   would refuse?** (Direct-hire fees, exclusive supplier arrangements,
   guaranteed worker placements, contractual responsibility for worker
   training, etc.)

4. **What contradicts the company's marketplace-not-employer position?**
   List the specific operational patterns the company avoids precisely
   because they would weaken that position.

A well-authored factual baseline is 1–2 pages. Combined with `fact-pattern.md`,
it gives the agent a complete operational picture: positive (what we do) and
negative (what we don't).
