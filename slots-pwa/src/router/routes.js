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
        path: 'lobby',
        name: 'lobby',
        component: () => import('pages/LobbyPage.vue'),
      },
      {
        path: 'gem-fortune',
        name: 'gem-fortune',
        component: () => import('pages/SlotsPage.vue'),
      },
      {
        path: 'lucky-sevens',
        name: 'lucky-sevens',
        component: () => import('pages/LuckySevensPage.vue'),
      },
      {
        path: 'sugar-tumble',
        name: 'sugar-tumble',
        component: () => import('pages/SugarTumblePage.vue'),
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
