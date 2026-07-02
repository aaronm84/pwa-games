const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        redirect: '/menu',
      },
      {
        path: 'menu',
        name: 'menu',
        component: () => import('pages/MenuPage.vue'),
      },
      {
        path: 'slots',
        name: 'slots',
        component: () => import('pages/SlotsPage.vue'),
      },
      {
        path: 'how-to-play',
        name: 'how-to-play',
        component: () => import('pages/HowToPlayPage.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('pages/SettingsPage.vue'),
      },
    ],
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
