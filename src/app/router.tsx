import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/shell/app-shell'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { DataPage } from '@/features/data/data-page'
import { ExampleContent, PublicExamplePage } from '@/features/example/example-page'
import {
  ContactPage,
  HelpPage,
  PrivacyPage,
  SignInPage,
  TermsPage,
} from '@/features/marketing/info-pages'
import { LandingPage } from '@/features/marketing/landing-page'
import { MarketingLayout } from '@/features/marketing/marketing-layout'
import { NewProductPage } from '@/features/new-product/new-product-page'
import { NotFoundPage } from '@/features/not-found'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { WorkspacePage } from '@/features/workspace/workspace-page'

export const routes: RouteObject[] = [
  {
    // The public site.
    element: <MarketingLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'example', element: <PublicExamplePage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'sign-in', element: <SignInPage /> },
    ],
  },
  {
    // The application. Everything under /app reads and writes the local database.
    path: 'app',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage />, handle: { title: 'Dashboard' } },
      { path: 'new', element: <NewProductPage />, handle: { title: 'New product' } },
      { path: 'workspace', element: <WorkspacePage />, handle: { title: 'Workspace' } },
      { path: 'onboarding', element: <OnboardingPage />, handle: { title: 'Guide' } },
      { path: 'example', element: <ExampleContent />, handle: { title: 'Example roadmap' } },
      { path: 'data', element: <DataPage />, handle: { title: 'Data and backup' } },
      {
        path: 'design-system',
        lazy: async () => ({
          Component: (await import('@/features/design-system/design-system-page')).DesignSystemPage,
        }),
        handle: { title: 'Design system' },
      },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Not found' } },
    ],
  },
  { path: '*', element: <MarketingLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
]

export const router = createBrowserRouter(routes)
