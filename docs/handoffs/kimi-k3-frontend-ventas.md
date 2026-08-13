# Handoff para Kimi K3 — Módulo de Ventas (rama `feature/ventas`)

> **Origen:** Sesión GLM‑5.2 (2026‑08‑05). Rol GLM: Supabase + plan. Rol Kimi K3:
> implementar el frontend completo del módulo de Ventas en `frontend/src/domains/ventas/`.
> **No editar el archivo a mano para "resumirlo";** es la fuente de verdad que Kimi K3
> usará para construir la UI sin pisar la base de datos.

---

## 1. Contexto del proyecto

Ondina es un ERP de embotelladora de agua y hielo. El repositorio ya tiene un
frontend React + Vite + TypeScript funcional en `frontend/` (login y módulos
genéricos que debes **rellenar** — no crear una app nueva). Trabajamos sobre la
rama `feature/ventas` (salida de `develop`).

Lee obligatoriamente **`AGENTS.md`** antes de escribir código: contiene todas las
convenciones que debes respetar. Resumen no exhaustivo:

- TypeScript estricto (`noUnusedLocals`, `noUnusedParameters`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`). Usa **`import type`** para
  imports solo de tipos (obligatorio por `verbatimModuleSyntax`).
- Dominios como módulos en `frontend/src/domains/`. La lógica de `ventas` debe
  vivir en `frontend/src/domains/ventas/`; no la saques de ahí.
- No accedas a Supabase directamente desde componentes de presentación. Usa el
  cliente compartido en `frontend/src/lib/supabase.ts` y crea servicios/hookes
  por dominio.
- Componentes en `PascalCase`, hooks `useCamelCase`, utilidades `camelCase`,
  carpetas `kebab-case`. Conceptos de dominio en español.
- **Mensajes al usuario en español.** Sin `console.log`, sin secretos en el
  repo, sin emojis (salvo petición explícita).
- No agregar dependencias nuevas sin justificarlas en el PR.

Stack:

- React + Vite + TypeScript estricto
- TanStack Query (datos remotos)
- React Hook Form + Zod (formularios)
- Tailwind (estilos)
- Supabase (backend / datos / Auth)

## 2. Estado de Supabase al cierre de GLM‑5.2

El proyecto Supabase remoto ya tiene aplicado el esquema completo del módulo de
ventas y objetos nuevos de esta sesión. Lo relevante para Kimi K3:

### 2.1 Tablas en uso (las que necesitarás leer o escribir)

| Tabla             | Para qué la usas                                                 |
| ----------------- | ---------------------------------------------------------------- |
| `clientes`        | HU‑02 (insert), HU‑04 (select cartera)                           |
| `carga_vendedor`  | HU‑03 (select)                                                   |
| `gastos_extras`   | HU‑07 (insert + select día; **sin** file Storage en este scope) |
| `venta_detalles`  | No insert directo: ya lo hace la RPC `registrar_venta`           |
| `ventas`          | Lectura del histórico del vendedor (no la creas por insert)      |
| `productos`       | Select para UI (precios referenciales, nombres)                 |
| `tipos_empaque`   | Select para mostrar el nombre del envase (HU‑05)                 |
| `perfiles`        | Datos del usuario autenticado (rol, sucursal_id, nombres). Se lee desde el AuthProvider |

### 2.2 RPC `registrar_venta` (HU‑01) — firma exacta

```ts
// supabase.rpc('registrar_venta', {...})
{
  p_cliente_id: string,            // uuid válido
  p_metodo_pago: 'efectivo' | 'transferencia',
  p_detalles: Json,                // [{producto_id, cantidad, precio_unitario, envases_recibidos}]
  p_descuento?: number,            // default 0, >= 0
  p_observaciones?: string | null  // default null
}
// devuelve: uuid (id de la venta creada)
```

Detalles críticos:

- **No envíes tipo_documento ni folio_documento.** La emisión de boleta/factura
  (HU‑06) quedó **fuera de alcance** por el producto. La venta se crea sin
  documento tributario.
- La función valida que el cliente pertenezca a la sucursal del vendedor y a su
  cartera (o que el llamador sea administrador).
- Los detalles van como **JSONB**. Cada fila: `{producto_id, cantidad (>0),
  precio_unitario (>=0), envases_recibidos (>=0, opcional default 0)}`.
- Los triggers de BD descuentan `carga_vendedor` por cada detalle y recalculan
  `ventas.total = sum(subtotal) - descuento`. Si algún detalle falla (carga
  insuficiente, producto inexistente), la transacción completa hace rollback.
- Errores que debes traducir al español en la UI (cadena de `error.message`
  devuelta por Postgres):
  - `'Cliente inexistente o fuera de su cartera/sucursal'`
  - `'Método de pago inválido (efectivo o transferencia)'`
  - `'La venta debe incluir al menos un detalle'`
  - `'El vendedor no tiene carga del producto %'` → "No tienes carga suficiente
    de ese producto"
  - `'Carga insuficiente del vendedor para el producto %'` → igual
- Ejemplo de uso con el cliente compartido:

  ```ts
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_cliente_id: clienteId,
    p_metodo_pago: metodo,
    p_detalles: detalles.map((d) => ({
      producto_id: d.productoId,
      cantidad: d.cantidad,
      precio_unitario: d.precioUnitario,
      envases_recibidos: d.envasesRecibidos ?? 0,
    })),
    p_descuento: descuento,
    p_observaciones: observaciones,
  });
  ```

### 2.3 Vista `v_bidones_vacios_vendedor` (HU‑05)

```text
Columnas:
  vendedor_id     uuid
  fecha           date
  tipo_empaque_id uuid
  empaque_nombre  text
  cantidad        numeric
```

- Es `SECURITY INVOKER`: respeta RLS del llamador. El frontend debe filtrar por
  vendedor y por fecha:

  ```ts
  supabase
    .from('v_bidones_vacios_vendedor')
    .select('vendedor_id, fecha, tipo_empaque_id, empaque_nombre, cantidad')
    .eq('vendedor_id', perfil.id)
    .eq('fecha', hoy /* 'YYYY-MM-DD' */);
  ```

- Suma los `envases_recibidos` de las ventas no anuladas del vendedor del día
  más las devoluciones de envases en estado 'bueno' de despachos del vendedor
  ese mismo día. El frontend solo muestra el resultado (no recalcula).
- Si no hay movimientos en el día, la consulta puede devolver filas vacías;
  mostrale al usuario "Aún no has registrado envases hoy".

### 2.4 Reglas de negocio ya resueltas en la BD — **NO duplicar en React**

Estas son verdades garantizadas por la base de datos. Si las reimplementas en
React, vas a duplicar lógica y romperlas vía REST. Solo consume los resultados:

1. **Descuento de carga al vender.** Al insertar `venta_detalles`, el trigger
   `trg_venta_detalle_insert` descuenta `carga_vendedor` y suma a
   `stock_envases` los `envases_recibidos`. — *No restes en el frontend.*
2. **Recálculo de `ventas.total`.** El trigger `trg_venta_recalcular_total`
   recalcula `total = sum(subtotal) - descuento` por cada detalle insert,
   update, o delete. — *No calcules `total` en React para guardarlo.* (Sí
   puedes mostrar un preview antes de confirmar, pero el guardado lo hace BD.)
3. **Reversión por anulación.** Cuando `anulado` pasa de `false` a `true`,
   las triggers de reversión devuelven stock a su estado previo. Solo el
   rol `administrador` puede anular (policy `ventas_update_admin`,
   `gastos_extras_update_admin`, etc.). Para el **vendedor**, la operación
   queda cerrada: puede crear; no puede editar ni anular.
4. **Auditoría automática.** Cada INSERT/UPDATE/ANULACION sobre ventas,
   gastos_extras, venta_detalles, etc. ya escribe en `auditoria`. No manejes
   auditoría desde React.
5. **No se elimina registro operativo.** Las políticas DELETE no existen en
   `ventas`, `gastos_extras`, ni `venta_detalles` para el vendedor. El
   frontend no debe ofrecer botones de borrado para estas tablas.
6. **RLS filtra por vendedor.** La policy
   `clientes_select_cartera` (`vendedor_id = auth.uid() or es_rol('administrador')`)
   ya bloquea el acceso a clientes ajenos. La policy de
   `carga_vendedor_select_propio` y `ventas_select_propio` igual. La de
   `gastos_extras_select_propio` igual.

   Por lo tanto, **no necesitas** agregar `.eq('vendedor_id', perfil.id)` a
   cada query por seguridad — pero **sí** para performance (RLS no siempre
   empuja el filtro al índice). Hazlo siempre en queries de lista:

   ```ts
   supabase.from('clientes').select('id, nombre, direccion, ...')
     .eq('vendedor_id', perfil.id)
     .eq('activo', true);
   ```

### 2.5 helpers RLS internos (no usarlos)

`public.es_rol(text)` y `public.mi_sucursal()` existen en la BD pero
**NO están expuestas vía REST** (revocadas a `anon` y `authenticated` por
seguridad). El frontend no debe llamarlas. Para conocer el rol/sucursal del
usuario autenticado, usa los datos que ya te entrega `AuthProvider` (ver
`frontend/src/context/auth-context.ts`).

### 2.6 Storage de comprobantes (HU‑07) — **fuera de alcance en este sprint**

El bucket `comprobances` ya existe en Storage con policies, pero el upload
de fotos quedó **fuera de alcance** por el producto. Para HU‑07 solo
implementas el **registro textual del gasto**: monto, tipo, motivo, sin adjunto.
El campo `gastos_extras.comprobante_url` queda `null` en este sprint. Queda
pendiente para una iteración posterior.

## 3. Mapeo por HU — qué construir en el frontend

Trabaja **una HU a la vez**, abre tu PR hacia `develop` con squash, y ajusta
el seguimiento con `bd` (lee `bd prime` en otra terminal si necesitas
referencia; NO uses TodoWrite ni markdown TODO).

### HU‑02 — Registrar cliente

Criterios que cubres:
- Vendedor/admin autenticado crea una ficha con nombre, contacto, dirección,
  número del local y tipo (`mayorista` | `minorista` | `ocasional`).
- Campos obligatorios: nombre, direccion, tipo. telefono y numero_local
  opcionales.
- El cliente queda asociado a la cartera del vendedor autenticado
  (`vendedor_id = auth.uid()`).
- El vendedor **no puede editar** la ficha una vez registrada (RLS permite
  update pero el logueado no mostrará botón de edición — no provee control
  de borrado).

Implementación sugerida:
- Formulario RHF + Zod. Campos ocultos (no pedidos al usuario) que rellenas
  desde el perfil autenticado:
  ```ts
  const perfil = useAuth(); // ya trae id, sucursal_id, rol
  // Insert:
  supabase.from('clientes').insert({
    nombre, telefono, direccion, numero_local, tipo,
    vendedor_id: perfil.id,
    sucursal_id: perfil.sucursal_id,
    creado_por: perfil.id,
    activo: true,
  });
  ```
- Schema Zod (al menos): `nombre` (string 1..120), `direccion` (1..200),
  `telefono` (opcional, formato teléfono chileno libre — no validar regex
  estricta), `numero_local` (opcional, string 0..50), `tipo` (enum)
  **default `'minorista'`**.
- Mensajes de éxito/error en español. Botón "Guardar cliente" visible en
  pantallas táctiles.
- Si el rol es administrador, permitir elegir `vendedor_id` (combo con
  vendedores activos de la sucursal — hay policy `perfiles_select_propio`
  que los deja leer). Si no, fija `vendedor_id = auth.uid()`.
- No proveer botón de borrado (policy DELETE es admin‑only; mantenerlo fuera
  del flujo del vendedor).

### HU‑04 — Consultar clientes de la ruta

- Rellena el componente existente `frontend/src/domains/ventas/pages/Clientes.tsx`.
- Hook `useClientesRuta` (TanStack Query):
  ```ts
  supabase.from('clientes')
    .select('id, nombre, telefono, direccion, numero_local, tipo, activo, creado_en')
    .eq('vendedor_id', perfil.id)
    .eq('activo', true)
    .order('nombre', { ascending: true });
  ```
- UI: lista responsive (cards en mobile, tabla en desktop). Estados
  obligatorios: cargando, vacío ("No tienes clientes en tu ruta"),
  error (mensaje simple, sin detalle técnico).
- Botón "Nuevo cliente" que abre el formulario de HU‑02 (modal o página aparte).
- Al crear cliente exitosamente, invalidar `useClientesRuta` para que la lista
  refleje el alta inmediatamente (HU‑04 criterio 3).

### HU‑07 — Registrar gasto extra (sin Storage, sin adjuntos en esta entrega)

- Formulario RHF + Zod. Campos: `tipo` (enum `'combustible' | 'averia' | 'otra'`
  — default `'otra'`), `monto` (number > 0), `motivo` (string no vacío).
- Insert:
  ```ts
  supabase.from('gastos_extras').insert({
    tipo, monto, motivo,
    vendedor_id: perfil.id,
    sucursal_id: perfil.sucursal_id,
    creado_por: perfil.id,
    anulado: false,
    comprobante_url: null,
  });
  ```
- No muestres input de archivo ni menciones comprobantes en esta versión.
- Listado `Gastos.tsx` con los gastos del día del vendedor:
  ```ts
  supabase.from('gastos_extras')
    .select('id, tipo, monto, motivo, creado_en, anulado')
    .eq('vendedor_id', perfil.id)
    .gte('creado_en', inicio_dia)  // hoy 00:00 local
    .lt('creado_en', fin_dia)     // mañana 00:00 local
    .order('creado_en', { ascending: false });
  ```
- Si quieres, incluye listado histórico con filtro de fecha (opcional, no es
  criterio de aceptación).
- No muestres botón de anular o borrar (los inserts quedan cerrados para el
  vendedor; la anulación es solo de admnistración en otra HU).

### HU‑03 — Consultar carga asignada

- Crea página `Carga.tsx` (o use el `Ventas.tsx` con tabs).
- Hook `useCargaVendedor`:
  ```ts
  supabase.from('carga_vendedor')
    .select('producto_id, cantidad, modificado_en, productos(id, nombre, tipo, precio_base)')
    .eq('vendedor_id', perfil.id);
  ```
- UI: tarjetas por producto. Mostrar nombre, tipo, cantidad. Estado vacío:
  "Aún no se te ha asignado carga hoy".
- Solo lectura. No mostrar opciones de edición (la carga la crea bodega
  mediante despacho — fuera de módulo de ventas).

### HU‑05 — Consultar bidones vacíos

- Hook `useBidonesVacios` (ver firma en §2.3):
  ```ts
  supabase.from('v_bidones_vacios_vendedor')
    .select('vendedor_id, fecha, tipo_empaque_id, empaque_nombre, cantidad')
    .eq('vendedor_id', perfil.id)
    .eq('fecha', hoy);
  ```
- UI: contador grande con total del día (suma de `cantidad`), y desglose por
  tipo de empaque (`empaque_nombre` + `cantidad`).
- Estado vacío: "No has registrado envases recibidos hoy".
- Recalcular al refrescar manualmente (botón en toolbar) o al cambiar de día.

### HU‑01 — Registrar venta (el grueso del trabajo)

Criterios de aceptación traducidos a UI:

1. Vendedor selecciona cliente de su cartera (combo con búsqueda; al menos
   uno).
2. Agrega **al menos un** producto con su cantidad, precio unitario
   (default = producto.precio_base — el usuario puede editarlo), y
   `envases_recibidos` (default 0, opcional).
3. Indica método de pago (efectivo o transferencia). **No** pedir
   tipo_documento ni folio (HU‑06 fuera de alcance).
4. Descuento opcional ≥ 0 (default 0). Observaciones opcionales.
5. Confirmar invoca `registrar_venta` (ver §2.2). Mostrar confirmación con
   el `id` de la venta y total.
6. Manejar errores de Postgres con mensajes claros en español (ver §2.2).
7. El vendedor no puede editar ni borrar la venta después. La interfaz no
   debe proveer esos controles. Mostrar "Venta registrada — ver histórico"
   y enlazar a la lista de ventas del día.

Implementación sugerida:
- Formulario multi‑paso o single page con secciones:
  1. Cliente
  2. Detalles (tabla edit con add‑row)
  3. Pago (método + descuento + observaciones)
  4. Resumen y botón "Confirmar venta"
- Zod schema: `clienteId` uuid requerido, `metodoPago` enum, `descuento`
  number >= 0, `detalles` array con `.min(1)`, cada detalle con `productoId`
  uuid, `cantidad` int > 0, `precioUnitario` number >= 0, `envasesRecibidos`
  int >= 0 (default 0).
- Hook `useRegistrarVenta` (TanStack mutation):
  ```ts
  async function registrarVenta(input: RegistrarVentaInput) {
    const { data, error } = await supabase.rpc('registrar_venta', {
      p_cliente_id: input.clienteId,
      p_metodo_pago: input.metodoPago,
      p_detalles: input.detalles.map((d) => ({
        producto_id: d.productoId,
        cantidad: d.cantidad,
        precio_unitario: d.precioUnitario,
        envases_recibidos: d.envasesRecibidos,
      })),
      p_descuento: input.descuento,
      p_observaciones: input.observaciones ?? null,
    });
    // mapear error.message a español (ver §2.2)
    return data as string;
  }
  ```
- Preview del total antes de confirmar (suma de subtotales − descuento) es
  estético; no se guarda en BD — la BD lo calcula. Suficiente con mostrarlo.
- tras éxito, invalidar `useCargaVendedor` (la carga cambió) y
  `useBidonesVacios` (eventualmente).

## 4. Estructura de archivos sugerida

```
frontend/src/domains/ventas/
├── index.tsx                    # exporta DomainModule (rutas + nav)
├── api.ts                       # servicios Supabase por HU
├── types.ts                     # tipos del dominio (re‑usa database-generated.types.ts)
├── schemas.ts                   # schemas Zod del dominio
├── hooks/
│   ├── useClientesRuta.ts
│   ├── useCrearCliente.ts
│   ├── useCargaVendedor.ts
│   ├── useBidonesVacios.ts
│   ├── useCrearGasto.ts
│   └── useRegistrarVenta.ts
└── pages/
    ├── Ventas.tsx               # home del módulo (sumario + acceso a HU‑03, HU‑05)
    ├── RegistrarVenta.tsx       # formulario HU‑01
    ├── Clientes.tsx             # listado HU‑04 + modal HU‑02
    ├── RegistrarCliente.tsx    # formulario HU‑02 (puede ser modal)
    ├── Gastos.tsx               # registro + listado HU‑07
    └── Carga.tsx                # HU‑03
```

Reglas adicionales:
- `index.tsx` debe exportar `DomainModule` con el mismo patrón que usan
  los dominios existentes (`frontend/src/domains/bodega/index.tsx`,
  `frontend/src/domains/index.ts`). Mira antes de crear el tuyo.
- Evita exportar el cliente `supabase` fuera de `api.ts`. Los hooks usan
  los servicios de `api.ts`.
- Si necesitas tipos de BD, importa de
  `frontend/src/types/database-generated.types.ts`. No redeclares `Database`
  — usa el `Database` que ya está exportado ahí.

## 5. Pruebas mínimas por HU (Vitest + Testing Library)

Cada HU debe tener al menos una prueba cubriendo el criterio de aceptación más
critico del flujo principal:

| HU   | Prueba                                                                   |
| ---- | ----------------------------------------------------------------------- |
| HU‑02 | Rellena campos válidos → llama insert con vendedor_id=auth.uid()        |
| HU‑04 | Lista vacía → muestra estado vacío; con datos → renderiza nombres      |
| HU‑07 | Monto <= 0 → schema inválido; válido → llama insert                    |
| HU‑03 | Lista vacía → "Aún no se te ha asignado carga hoy"; con datos → tarjs  |
| HU‑05 | Sin filas en la vista → "No has registrado envases recibidos hoy"      |
| HU‑01 | validación Zod exige cliente + ≥1 detalle + método; éxito llama rpc    |

Usa `vi.mock('@/lib/supabase')` para simular el cliente. Nombres de pruebas
en español, Arrange‑Act‑Assert.

## 6. Definition of Done para el PR de ventas

- [ ] `npm run lint` pasa en `frontend/`.
- [ ] `npm run build` pasa en `frontend/`.
- [ ] Cada HU listada cumple sus criterios de aceptación.
- [ ] Inputs validados en el frontend (Zod) y respetan las constraints de BD.
- [ ] Autorización validada por RLS (no escrito por ti; ya está) — tu UI no
      ofrece controles que la RLS bloquearía para el rol vendedor (sin
      botones de borrado/edición de ventas o gastos).
- [ ] Mensajes al usuario en español.
- [ ] Sin `console.log`, sin secretos, sin código comentado.
- [ ] Commits tipo `feat(ventas): registrar cliente [HU-02]`, mensaje en
      español imperativo, máximo 72 chars en el subject.
- [ ] Solo tocas archivos bajo `frontend/src/domains/ventas/` y, si es
      imprescindible, `frontend/src/types/*.ts` (sin romper `database.ts`).
- [ ] Tu PR describe qué cubre (HU‑XX), cómo probarlo (Vitest), cómo validar
      RLS (caso negativo: vendedor B no ve ventas de vendedor A) y qué
      quedó fuera de scope (HU‑06 boletas, upload HU‑07).

## 7. Pendientes claros que el producto confirmó fuera de este sprint

- **HU‑06 Generar boleta/factura.** No implementes UI de documentos
  tributarios. La BD ya tiene las columnas `tipo_documento` y
  `folio_documento` en `ventas`; en una futura iteración se completarán.
- **Upload de Storage para comprobantes de HU‑07.** El bucket `comprobantes`
  existe en Storage; las policies existen; pero el flujo de upload está
  pendiente. No muestres el control de archivo en esta versión.

## 8. Lo que GLM‑5.2 dejó en el repo (para que sepas qué NO tocar)

- `supabase/migrations/0001_init.sql` — baseline de esquema existente
  (no lo corras, ya está aplicado en remoto; sirve para entorno limpio).
- `supabase/migrations/0002_modulo_ventas.sql` — RPC `registrar_venta` +
  vista `v_bidones_vacios_vendedor` + revokes. Ya aplicado.
- `supabase/migrations/0003_correcciones_seguridad_ventas.sql` — correciones
  del ERROR/warn detectados tras 0002. Ya aplicado.
- `frontend/src/types/database-generated.types.ts` — tipos generados desde
  la BD remota (incluyen `registrar_venta` y `v_bidones_vacios_vendedor`).
- Este archivo `docs/handoffs/kimi-k3-frontend-ventas.md`.

Si necesitas regenerar los types porque modificaste el `lib/supabase.ts`, no
lo hagas TU; avisa para que GLM lo regenere desde Supabase MCP.

## 9. Comandos para validar tu trabajo

```bash
cd frontend
npm install        # si falta deps del dominio actual
npm run lint
npm run build
npm run dev        # smoke manual
npx vitest run     # tests del dominio
```

## 10. Cómo abrir el PR

```bash
git checkout -b feature/ventas  # si no estás ya
# implementa una HU
git add frontend/src/domains/ventas/
git commit -m "feat(ventas): registrar cliente [HU-02]"
# repite por HU
git pull --rebase
git push -u origin feature/ventas
# abre PR por squash contra `develop`, no `main`
```

> Recuerda: al final de tu sesión, `git status` debe mostrar "up to date with
> origin". Lee `AGENTS.md` secciones "Cierre De Sesión" y "Ramas Y Flujo De
> Trabajo" para el protocolo completo.

---

**Fin del handoff.** Cualquier déficit de información o ambigüedad, abre un
issue de beads describiendo la duda (no edites este archivo) y resuélvelo con
el humano antes de codificar. No improvises contratos que cambien Supabase —
eso lo hace GLM‑5.2 desde acá.