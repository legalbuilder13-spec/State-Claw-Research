# Standing Fact Pattern

> **Operator: replace this entire document with your company's actual operating
> fact pattern.** This file is loaded into every run; it grounds the agent's
> analysis in *your* business reality rather than an abstract two-sided marketplace.

## What this document is

This is the agent's "ground truth" about how the company operates day-to-day.
Every analysis the agent produces is implicitly answering the question *as
applied to this fact pattern*, not as applied to a hypothetical company.

A vague fact pattern produces vague analyses. Be specific. Describe:

- **What the platform does at each stage** of the booking lifecycle.
- **Who actually does what** between the company, the demand-side party, and the supply-side worker.
- **What the platform does NOT do** (also captured separately in [`factual-baseline.md`](factual-baseline.md)).
- **What technology mediates each interaction** — the marketplace-not-employer position depends on the company being technology infrastructure rather than an employment-relationship participant.

---

## Generic placeholder (delete and replace)

### Overview

`<Company>` operates an online marketplace connecting `<Customer Type>` with
independent `<Worker Type>` who provide `<services / labor / fulfillment>` directly
to those customers. The platform is the technology infrastructure that enables
the two parties to discover one another, agree terms, transact, and complete
the engagement.

`<Company>` is not a party to the work performed. The platform mediates
discovery and transaction; the work itself is between the demand-side
party and the worker.

### Eligibility verification (gatekeeping, not supervisory)

Before a `<Worker Type>` can book engagements via the platform, `<Company>`
runs an eligibility verification that confirms basic identity, licensing /
certification status, and disqualifying criminal background. This is a
marketplace-level gatekeeping function — it determines *who* can participate
in the marketplace, not *how* the worker performs the engagement once on-site.

The verification covers:
- Identity confirmation against `<state-issued ID type>` or equivalent.
- Licensing / certification verification against `<official issuing authority>`
  via primary-source verification.
- Disqualifying-criminal-record screening through a third-party background-check
  provider.
- `<industry-specific eligibility checks, if any>`.

Workers upload supporting documentation to the platform; document submission
specialists verify completeness. Customers / facilities may impose **additional**
eligibility requirements (e.g., facility-specific orientation completion);
those are operator-controlled, not `<Company>`-controlled.

### Booking lifecycle

1. Customer / facility posts an open engagement with requirements (time, place,
   skill, rate).
2. Eligible workers browse open engagements and book the ones they want.
3. Worker performs the engagement at the customer's site, using customer-provided
   tools and following customer-set processes (or worker's own methods,
   depending on the engagement type).
4. Worker indicates completion via the app; customer confirms.
5. `<Company>` facilitates the payment flow — the customer pays the agreed
   rate; `<Company>` retains a marketplace fee; the worker receives net
   compensation through the platform's payment infrastructure.

### Training and education

`<Company>` does **not** administer training, education, or skills-development
programs. Workers arrive at the platform already licensed and credentialed for
the work they offer; customer / facility-specific training and orientation, if
any, is controlled by the customer / facility — `<Company>`'s role is limited
to making facility-provided materials available for review and confirming
acknowledgment.

### Supervision

`<Company>` does **not** supervise the worker's performance of the engagement.
Supervision (if applicable to the engagement type) is exercised by the customer
or by licensed personnel at the customer's site. `<Company>`'s role ends at
making the booking happen; the work itself is between the worker and the
customer.

### Evaluation and feedback

Because workers are independent contractors, `<Company>` does not conduct
employee performance evaluations. Customers may provide feedback through the
platform and may issue "Do Not Return" requests for specific workers. In
matters involving serious concerns, `<Company>` may investigate and document
through internal incident reports. These mechanisms are marketplace-integrity
tools — they are not performance management.

### Compensation

Workers and customers agree to engagement rates through the platform's
booking flow. `<Company>` does not unilaterally set the rate the worker
will accept; the platform's algorithms may suggest a rate range based on
market signals, but the worker decides whether to book at the offered
rate.

`<Company>` charges a **marketplace fee** for facilitating the connection
and the payment flow. `<Company>` does **not** charge `<Customer Type>` a
direct-hire / conversion / temp-to-perm fee if they hire a worker they met
through the platform.

---

## How to write your real fact pattern

Replace the placeholder above with text answering these questions in
detail:

1. **Exactly what does the platform do?** Discovery? Matching? Transaction?
   Payment? Compliance verification? Be precise — the line between "technology
   infrastructure" and "service provider" is often a paragraph-of-text away.

2. **Who controls what?** At each lifecycle stage, who has decision-making
   authority — the company, the customer, or the worker?

3. **What technology mediates each step?** Naming the technology (mobile app
   interface, automated matching algorithm, electronic payment flow) reinforces
   the "technology marketplace" position.

4. **What does the company actively avoid doing?** This is the contrapositive
   of #1. If you operate a healthcare staffing marketplace, you actively avoid
   directing clinical work; if you operate a delivery marketplace, you actively
   avoid setting delivery routes. Be explicit.

5. **What's verifiable in the audit chain?** Every fact-pattern claim that
   the agent will repeat in deliverables should be verifiable from the
   platform's actual data flows. Don't claim "workers set their own rates"
   if the algorithm sets the rate and the worker only accepts or rejects.

A well-authored fact pattern is 1–2 pages. Anything shorter is too vague to
be useful; anything longer is hard for the agent to consult on every run.
