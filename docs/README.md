# Documentation Map

Read the row relevant to the current task, then the linked source. Root instructions stay short; procedures and domain context load on demand.

| Task | Reference |
| --- | --- |
| Understand the business, objectives or scope | [Product context](product/context.md) |
| Check a requirement | [Canonical RF/RNF catalog](product/requirements.md) |
| Implement a user story | [Stories by domain](product/stories/README.md) and [implementation status](status/user-stories.md) |
| Change application structure | [Architecture](engineering/architecture.md) |
| Write UI or forms | [Frontend conventions](engineering/frontend.md) |
| Work with Git or quality checks | [Development](engineering/development.md) |
| Change SQL, Auth, RLS or stock rules | [Database](engineering/database.md) |
| Recover the database or plan backups | [Backups and recovery](engineering/backups.md) |
| Configure Supabase Auth, passwords or sessions | [Auth configuration](engineering/auth.md) |
| Configure CI/Vercel environments | [Deployment](engineering/deployment.md) |
| Use Beads, CodeGraph or Mem0 | [Agent tools](agents/tools.md) |
| Clarify domain terminology or an ADR | [Domain documentation](agents/domain.md) |
| Choose an installed skill | [Skill catalog](skills.md) |
| Supervise Orca workers | [Orchestration](orchestration/README.md) |
| Investigate an earlier audit | [Dated evidence](archive/README.md) |

## Maintenance

- Agent/engineering instructions are in English; Spanish product references preserve the customer's language and acceptance criteria.
- Keep one canonical description of each requirement or convention. Link it rather than copying it into another guide.
- Record implementation limits separately from requirements. Changing documentation does not resolve an open feature or security issue.
- Keep work status in Beads. Remove obsolete walkthroughs and completed implementation plans; Git retains their history.
- Keep dates on historical evidence. Do not load archived reports as standing agent instructions.

This layout follows [Claude's concise, scoped instruction guidance](https://code.claude.com/docs/en/memory) and [on-demand skills](https://code.claude.com/docs/en/skills). English is this repository's language policy.
