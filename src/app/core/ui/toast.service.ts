import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/** Tiny notification queue rendered by the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, tone: Toast['tone'] = 'info', durationMs = 3200): void {
    const toast = { id: this.nextId++, message, tone };
    this.toasts.update((list) => [...list, toast].slice(-3));
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
