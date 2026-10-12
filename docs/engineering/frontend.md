# Frontend Conventions

## Structure and types

Use domain services/hooks and the shared client. Keep strict TypeScript, type-only imports with `import type`, PascalCase components, `useCamelCase` hooks and camelCase utilities. User-facing messages stay in Spanish.
Keep React Hook Form input/output types distinct when Zod coerces or preprocesses values; use the lockfile-compatible resolver and `useForm<Input, Context, Output>` rather than suppressing type errors.

## Feedback

Use `frontend/src/lib/ui.ts` instead of duplicating error styles:

| Constant | Purpose |
| --- | --- |
| `errorTextCls` | Field validation beneath the input. |
| `inputErrorCls` | Invalid input styling. |
| `errorBlockCls` | Persistent mutation/error summary. |

Use `useToast`/`Toast` for write outcomes: `exito` for success, `error` for failed mutations or business validation. Field errors remain next to their input. Translate technical backend errors into useful Spanish feedback.
Reuse the existing Toast behavior, including auto-dismiss and mobile positioning; do not create a second notification system.

## Layout and numeric input

- Verify 375px, 768px and 1280px layouts, including keyboard use and horizontal overflow.
- Use one responsive DOM/form tree: tables may become cards below 640px, but must not duplicate RHF registrations.
- Stack form grids and allow headers/actions to wrap on small screens.
- Use the helpers in `frontend/src/lib/format.ts` for `es-CL` thousands, parsing and live formatting. Numeric text inputs use `inputMode="numeric"`; keep display strings separate from submitted values.
- Reuse established empty-input and validation behavior instead of parsing separators or assigning numeric defaults ad hoc.

## Comments

Explain non-obvious reasons with concise `//` comments and the related HU when useful. Reserve JSDoc/TSDoc for exported contracts that need it. Remove commented-out code and debugging logs; avoid restating readable implementation.
