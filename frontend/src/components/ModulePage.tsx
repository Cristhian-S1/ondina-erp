interface ModulePageProps {
  title: string
  description: string
}

export default function ModulePage({ title, description }: ModulePageProps) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <span className="mt-5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
        En construcción
      </span>
    </div>
  )
}
