# User-Story Sources

The Spanish descriptions and acceptance criteria preserve the original product specification. Load the relevant domain rather than all stories.

| Domain | Stories |
| --- | --- |
| [Sales and customers](sales.md) | HU-01–HU-09 |
| [Administration](administration.md) | HU-10–HU-17 |
| [Production](production.md) | HU-19–HU-23 |
| [Warehouse and dispatch](warehouse.md) | HU-24–HU-29 |
| [Authentication](authentication.md) | HU-31 |

There are 29 retained story specifications. HU-18 (day closing) and HU-30 (offline operations) were removed from delivery scope on 2026-08-01; IDs were not reassigned.
HU-05's seller UI was later removed, but its requirement is still recorded. Do not infer scope approval from a missing page or silently restore retired work.
Sprint 1 delivered 17 of the 29 stories (their GitHub issues are closed); the remaining 12 plus the HU-07 receipt upload are pending for Sprint 2. The [implementation matrix](../../status/user-stories.md) is the single source of truth for each story's sprint, GitHub issue and open follow-ups.
Use the [RF/RNF catalog](../requirements.md) for requirement numbers, [implementation matrix](../../status/user-stories.md) for current limits, and Beads for execution status. Descriptions use the actor/feature/benefit format; acceptance retains Dado/Cuando/Entonces and the original additional conditions.
