import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/components/shell/app-shell'
import { MarketingLayout } from '@/features/marketing/marketing-layout'
import { NotFoundPage } from '@/features/not-found'

/**
 * Pages load when you first go to them, so the first visit downloads only what it shows. Each is its own file
 * the browser can cache, and a change to one page does not invalidate the others.
 */
const page =
  <C extends React.ComponentType<never>>(load: () => Promise<C>) =>
  async () => ({
    Component: await load(),
  })

export const routes: RouteObject[] = [
  {
    // The public site.
    element: <MarketingLayout />,
    children: [
      {
        index: true,
        lazy: page(() => import('@/features/marketing/landing-page').then((m) => m.LandingPage)),
      },
      {
        path: 'example',
        lazy: page(() =>
          import('@/features/example/example-page').then((m) => m.PublicExamplePage),
        ),
      },
      {
        path: 'about',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.AboutPage)),
      },
      {
        path: 'help',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.HelpPage)),
      },
      {
        path: 'privacy',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.PrivacyPage)),
      },
      {
        path: 'terms',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.TermsPage)),
      },
      {
        path: 'contact',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.ContactPage)),
      },
      {
        path: 'sign-in',
        lazy: page(() => import('@/features/marketing/info-pages').then((m) => m.SignInPage)),
      },
    ],
  },
  {
    // The application. Everything under /app reads and writes the local database.
    path: 'app',
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: page(() =>
          import('@/features/dashboard/dashboard-page').then((m) => m.DashboardPage),
        ),
        handle: { title: 'Dashboard' },
      },
      {
        path: 'new',
        lazy: page(() =>
          import('@/features/new-product/new-product-page').then((m) => m.NewProductPage),
        ),
        handle: { title: 'New product' },
      },
      {
        path: 'workspace',
        lazy: page(() =>
          import('@/features/workspace/workspace-page').then((m) => m.WorkspacePage),
        ),
        handle: { title: 'Overview' },
      },
      {
        path: 'workspace/objectives',
        lazy: page(() =>
          import('@/features/planning/objectives-page').then((m) => m.ObjectivesPage),
        ),
        handle: { title: 'Objectives' },
      },
      {
        path: 'workspace/initiatives',
        lazy: page(() =>
          import('@/features/planning/initiatives-page').then((m) => m.InitiativesPage),
        ),
        handle: { title: 'Initiatives' },
      },
      {
        path: 'workspace/prioritise',
        lazy: page(() => import('@/features/planning/matrix-page').then((m) => m.MatrixPage)),
        handle: { title: 'Prioritise' },
      },
      {
        path: 'roadmaps',
        lazy: page(() => import('@/features/roadmap/roadmaps-page').then((m) => m.RoadmapsPage)),
        handle: { title: 'Roadmaps' },
      },
      {
        path: 'roadmaps/:roadmapId',
        lazy: page(() => import('@/features/roadmap/roadmap-page').then((m) => m.RoadmapPage)),
        handle: { title: 'Roadmap' },
      },
      {
        path: 'workspace/features',
        lazy: page(() => import('@/features/planning/features-page').then((m) => m.FeaturesPage)),
        handle: { title: 'Features' },
      },
      {
        path: 'onboarding',
        lazy: page(() =>
          import('@/features/onboarding/onboarding-page').then((m) => m.OnboardingPage),
        ),
        handle: { title: 'Guide' },
      },
      {
        path: 'templates',
        lazy: page(() =>
          import('@/features/templates/templates-page').then((m) => m.TemplatesPage),
        ),
        handle: { title: 'Templates' },
      },
      {
        path: 'example',
        lazy: page(() =>
          import('@/features/example/example-page').then((m) => () => <m.ExampleContent app />),
        ),
        handle: { title: 'Example roadmap' },
      },
      {
        path: 'data',
        lazy: page(() => import('@/features/data/data-page').then((m) => m.DataPage)),
        handle: { title: 'Data and backup' },
      },
      {
        path: 'design-system',
        lazy: page(() =>
          import('@/features/design-system/design-system-page').then((m) => m.DesignSystemPage),
        ),
        handle: { title: 'Design system' },
      },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Not found' } },
    ],
  },
  { path: '*', element: <MarketingLayout />, children: [{ path: '*', element: <NotFoundPage /> }] },
]

export const router = createBrowserRouter(routes)
