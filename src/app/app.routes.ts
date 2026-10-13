import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'design' },
  {
    path: 'design',
    title: 'Design · Formloom',
    loadComponent: () => import('./features/design/design-page').then((m) => m.DesignPage),
  },
  {
    path: 'preview',
    title: 'Preview · Formloom',
    loadComponent: () => import('./features/preview/preview-page').then((m) => m.PreviewPage),
  },
  {
    path: 'json',
    title: 'JSON · Formloom',
    loadComponent: () => import('./features/json/json-page').then((m) => m.JsonPage),
  },
  { path: '**', redirectTo: 'design' },
];
