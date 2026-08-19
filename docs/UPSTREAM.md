# Upstream: the private lab this product harvests from

Read this before porting anything. It is the public-repo half of the
workflow defined in the private repo's PORTING-RUNBOOK.md
(claude-projects/fantasy-football/PORTING-RUNBOOK.md, private repo
github.com/LeviZ/fantasy-football).

## The relationship

- The upstream is `claude-projects/fantasy-football/levi-sheet/`: Levi's
  personal draft tool for his real 2026 league. It is the reference
  implementation and the proving ground. This repo is a SEPARATE BUILD that
  reimplements proven ideas for a client-only, bring-your-own-data product.
  There is no git relationship between the repos and never will be.
- **Priority always goes upstream.** Iteration and dial-in happen there
  first, against real use. If a feature idea surfaces while working here and
  it is not public-only infrastructure, the default is: note it, do not
  build it - it should be proven upstream first.
- The upstream is a MOVING TARGET until Levi's real draft (~early Sept
  2026), then it freezes for the season and a final harvest sweep runs.

## What an agent working in this repo must check

1. **Before any harvest work**: read the upstream's levi-sheet/README.md
   V-log and diff it against the audited V number recorded in
   phase-plans/UI-CARRYOVER.md. That gap is the work queue. Engine changes:
   audit upstream git log and README architecture notes the same way.
2. **Before porting any specific item**: check it against the NEVER-crosses
   list in the upstream PORTING-RUNBOOK.md. In short: mechanisms port, data
   and personal judgment do not. No projections, rankings, or market values
   of any provenance (MASTER-PLAN constraint 1); no league scoring priors,
   plan envelope numbers, my_calls, owner names, or AI-written player text;
   nothing from levi-sheet/secrets/ or the upstream databases, ever.
3. **Porting discipline**: follow UI-CARRYOVER.md ground rules - port
   verbatim, adapt only the data-access layer; divergence is legitimate only
   for infrastructure (no server), ratified scope cuts, or generalization
   (12 teams to N). Engine ports must pass the golden-master verify suite in
   verify/ before landing.
4. **Porting is Levi's decision.** Agents propose candidates (add rows to
   the appropriate bucket table with rationale); Levi ratifies which rows
   land in which round. Every landed round is a V-bump here and gets
   screenshot review.
5. **Never modify the upstream** from this workstream. levi-sheet/ is
   read-only reference material; even fixing an obvious upstream bug is a
   proposal to make in an upstream session, not an edit from here.
