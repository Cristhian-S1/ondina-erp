# E3 — Catalog and Versioned Commission Rules (HU-17, HU-15)

[Sprint 2 index](README.md)

## Objective

Administrators maintain products and container types, including deactivation with history (HU-17). They also publish commission rules that apply from a future date without changing past commissions (HU-15).

## Covers

- HU-17 (#65, OND-w76.8).
- HU-15 (#63, OND-w76.6).

**Roles:** Backend/Supabase, Frontend (`administracion`), Testing. **Depends on:** E2 for the admin screens. The database guards already exist.

## Repository evidence

- **Catalog:** `productos` and `tipos_empaque` have `activo` (`supabase/migrations/20261013000000_remote_baseline.sql:1204-1214, 1278-1284`). `private.proteger_catalogo_historico` blocks changing `tipo`/`tipo_empaque_id` on products already used (`20261013184049_b3_data_integrity.sql:74-85`). Past prices are safe because each `venta_detalles` line stores its `precio_unitario`.
- **Catalog gaps:** no write grant or policy after B2, and the catalog tables are not audited.
- **Commission rules:** `reglas_comision` has a `[)` non-overlap exclusion per `tipo_producto` (btree_gist) and `private.proteger_regla_historica`, which blocks rewriting or backdating rules used by sales. `v_comision_vendedor` computes as of `ventas.creado_en` (`b3:813-859`; [database](../../engineering/database.md)). Rules are audited.
- **Schema dimension:** only `tipo_producto in ('agua','hielo')`, with no sucursal or per-seller dimension (`remote_baseline.sql:1232`).
- **Frontend:** reads go through `frontend/src/lib/catalog.ts:4-28`.

## Options — HU-17

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. RPCs `crear_producto`, `actualizar_producto` (name, `precio_base`, `activo`) and `desactivar_producto`, plus the same for `tipos_empaque`; unique index on the normalized name; add the catalog tables to `fn_auditoria_simple`; no DELETE | Matches #65; keeps the historical guard; the reason (`ondina.motivo`) can be set | Needs a decision on what counts as a duplicate | M (3–4 d) |
| B. Admin policies plus column-level `grant update (nombre, precio_base, activo)` | Less SQL | `ondina.motivo` cannot be set from plain REST; validation is weaker | S–M (2–3 d) |
| C. Effective-dated price table `precios_producto` | Answers "vigencias" | Not needed while each line stores its price; extra joins in `registrar_venta` | L |

**Recommendation: A.** Choose C only if the owner confirms that price vigencies are required.

## Options — HU-15

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. RPC `crear_regla_comision(tipo, porcentaje, monto, vigente_desde)` that closes the open rule and inserts the new one atomically; future-dated only; global admin only. Also a read-only "simulate" RPC for a past period | Relies on the existing exclusion constraint and history guard ([range types](https://www.postgresql.org/docs/current/rangetypes.html)); no overlap by construction | Who can edit and which dimensions apply are still open | M (3–4 d) |
| B. Restore admin INSERT/UPDATE policies and write from the UI | Less SQL | Close + insert from the client is not atomic and can fail halfway | S–M |
| C. Add sucursal/seller dimensions now | Future-proof | Not requested; changes `v_comision_vendedor` and the B3 guards | L |

**Recommendation: A, including the simulation RPC.** #63 asks to "probar el resultado antes de activar"; define it in E1 as a recalculation over a past period that writes nothing.

## Acceptance criteria

- [ ] Creating a duplicate product (normalized name) fails (pgTAP).
- [ ] Changing a price leaves past `venta_detalles.precio_unitario` unchanged (pgTAP).
- [ ] Changing `tipo` on a used product fails; deleting a used product is denied (pgTAP).
- [ ] A deactivated product is not offered in RegistrarVenta, and `registrar_venta` rejects it (pgTAP; current behaviour [uncertain], verify first).
- [ ] Consecutive commission rules succeed; an overlapping or backdated rule fails (pgTAP).
- [ ] `v_comision_vendedor` returns the same values for past sales after a new rule (pgTAP).
- [ ] Non-admin writes are denied, and catalog and rule changes are audited (pgTAP).
- [ ] `npm run lint`, `npm run build` and `npm run test` pass from `frontend/`.

## Verification

`supabase test db`; the frontend commands; responsive check of the admin forms.

## Risks

- "Tipos de bidón" probably means `tipos_empaque` [uncertain].
- Rule dimensions may grow (bidón vs. agua) and force option C later.
- Cache invalidation of `lib/catalog.ts` after edits.
