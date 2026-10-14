import { Link } from 'react-router-dom'
import { btnSecondary } from '../lib/ui'

interface ModulePageProps {
  title: string
  description: string
}

/** Estado "Próximamente" para secciones cuya funcionalidad aún no existe. */
export default function ModulePage({ title, description }: ModulePageProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
        Próximamente
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">{description}</p>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        Esta sección todavía no está disponible; aún no hay nada que operar aquí.
      </p>
      <Link to="/" className={`${btnSecondary} mt-6`}>
        Volver al inicio
      </Link>
    </div>
  )
}
