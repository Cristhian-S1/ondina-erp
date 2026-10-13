#!/usr/bin/env python3
"""Read-only comparison of CLI schema dumps with the documented B1 additions."""
from pathlib import Path
from collections import Counter
import re
import argparse
parser = argparse.ArgumentParser(description='Compare a supplied baseline snapshot with local CLI public/full dumps.')
parser.add_argument('remote_snapshot', type=Path)
parser.add_argument('local_public_dump', type=Path)
parser.add_argument('local_full_dump', type=Path)
args = parser.parse_args()
remote = args.remote_snapshot.read_text()
local = args.local_public_dump.read_text()
extra = args.local_full_dump.read_text()
delta = (Path(__file__).resolve().parents[1] / 'migrations/20261013000100_align_repo_design.sql').read_text()

# Split only at top-level semicolons; preserve strings, quoted identifiers and
# dollar-quoted function bodies. Only outer whitespace/comments are normalized.
def statements(sql):
    result = []
    buf = []
    i = 0
    while i < len(sql):
        if sql.startswith('--', i):
            end = sql.find('\n', i)
            i = len(sql) if end < 0 else end
            continue
        if sql[i] in '\'"':
            q = sql[i]
            end = i + 1
            while end < len(sql):
                if sql[end] == q:
                    if end + 1 < len(sql) and sql[end + 1] == q:
                        end += 2
                        continue
                    end += 1
                    break
                end += 1
            buf.append(sql[i:end])
            i = end
            continue
        tag = re.match('\\$(?:[A-Za-z_]\\w*)?\\$', sql[i:]) if sql[i] == '$' else None
        if tag:
            end = sql.find(tag[0], i + len(tag[0]))
            assert end >= 0
            end += len(tag[0])
            buf.append(sql[i:end])
            i = end
            continue
        if sql[i] == ';':
            result.append(''.join(buf).strip())
            buf = []
            i += 1
            continue
        if sql[i].isspace():
            if buf and buf[-1] != ' ':
                buf.append(' ')
        else:
            buf.append(sql[i])
        i += 1
    assert not ''.join(buf).strip()
    return result

# CLI --schema public omits private helpers, so compare those in the full dump too.
def is_public(stmt):
    return bool(re.search('"public"[. ]|SCHEMA "public"', stmt))
bootstrap = {'CREATE SCHEMA IF NOT EXISTS "public"', 'ALTER SCHEMA "public" OWNER TO "pg_database_owner"'}
R = Counter((x for x in statements(remote) if is_public(x) and x not in bootstrap))
L = Counter((x for x in statements(local) if is_public(x) and x not in bootstrap))
removed = list((R - L).elements())
added = list((L - R).elements())
new_functions = re.findall('create or replace function public\\.(\\w+)', delta, re.I)
new_views = re.findall('create or replace view public\\.(\\w+)', delta, re.I)
new_triggers = re.findall('create trigger (\\w+)', delta, re.I)
new_indexes = re.findall('create index if not exists (\\w+)', delta, re.I)
changed_policies = re.findall('create policy "(\\w+)"', delta, re.I)
allowed_names = set(new_functions + new_views + new_triggers + new_indexes + changed_policies + ['incidencias_produccion_descripcion_largo'])

# Existing objects must remain identical; only documented delta DDL/ACLs may differ.
def is_allowed(stmt):
    header = stmt.split(' AS ', 1)[0].split(' USING ', 1)[0].split(' WITH CHECK ', 1)[0]
    if any(('"' + n + '"' in header for n in allowed_names)):
        return True
    return bool(re.match('ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"\\."(producciones|incidencias_produccion|stock_envases)"$', stmt))
assert all((x.startswith('CREATE POLICY ') and any(('"' + n + '"' in x for n in changed_policies)) for x in removed)), removed
unexpected = [x for x in added if not is_allowed(x)]
assert not unexpected, unexpected
RP = Counter((x for x in statements(remote) if '"private"' in x and (not is_public(x))))
LP = Counter((x for x in statements(extra) if '"private"' in x and (not is_public(x))))
assert RP == LP, (RP - LP, LP - RP)
print('Public-only dump also emits CLI-owned public schema creation/owner boilerplate; excluded from application-object comparison.')
print(f'PASS: public dump: {sum(R.values())} remote statements; {sum(L.values())} local statements; {len(removed)} replaced policy definitions; {len(added)} documented added/replacement statements.')
print(f'Added objects: {len(new_functions)} functions, {len(new_views)} views, {len(new_triggers)} triggers, {len(new_indexes)} secondary indexes, 1 NOT VALID CHECK, 3 Realtime bindings; {len(changed_policies)} policies replaced.')
print(f'PASS: all {sum(RP.values())} private-schema statements unchanged.')
print('PASS: all existing public tables/columns/constraints, functions, views, stock triggers, remaining policies and ACL statements unchanged.')
RE = Counter((x for x in statements(remote) if not is_public(x) and '"private"' not in x))
LE = Counter((x for x in statements(extra) if not is_public(x) and '"private"' not in x))
assert not RE - LE, RE - LE
assert list((LE - RE).elements()) == ['CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions"'], LE - RE
print('Whole dump: one CLI-managed extension difference outside public (pg_net); no other unexplained statements.')
