import type { ComponentType, ReactNode } from 'react'
import type { Role } from './index'
import type { IconProps } from '../components/icons'

export interface NavItem {
  path: string
  label: string
  icon: ComponentType<IconProps>
  roles: Role[]
}

export interface RouteItem {
  path: string
  element: ReactNode
}

export interface DomainModule {
  name: string
  nav: NavItem[]
  routes: RouteItem[]
}
