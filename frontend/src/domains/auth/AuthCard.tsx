import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.jpg'

export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-gradient-to-br from-brand-50/70 via-slate-100 to-brand-100/60 p-4">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border border-brand-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="text-center">
          <img src={logo} alt="Ondina" className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-sm" />
          <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        </div>
        {children}
        <Link to="/login" className="flex min-h-11 items-center justify-center text-sm font-medium text-brand-800 underline">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  )
}
