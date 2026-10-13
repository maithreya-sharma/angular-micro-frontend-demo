import { JsonPipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { parseSchema } from '../../core/schema/schema-io';
import { decodeSchema } from '../../core/share/share-codec';
import { BuilderStore } from '../../core/state/builder-store';
import { ToastService } from '../../core/ui/toast.service';
import { FormRenderer } from './form-renderer';

@Component({
  selector: 'fl-preview-page',
  imports: [FormRenderer, JsonPipe, RouterLink],
  templateUrl: './preview-page.html',
  styleUrl: './preview-page.scss',
})
export class PreviewPage implements OnInit {
  protected readonly store = inject(BuilderStore);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** `?form=…` from a share link, bound by withComponentInputBinding(). */
  readonly form = input<string>();

  protected readonly device = signal<'desktop' | 'phone'>('desktop');
  protected readonly result = signal<Record<string, unknown> | null>(null);

  async ngOnInit(): Promise<void> {
    const code = this.form();
    if (!code) return;
    try {
      const { schema, errors } = parseSchema(await decodeSchema(code));
      if (!schema) throw new Error(errors[0]);
      this.store.load(schema);
      this.toasts.show(`Opened "${schema.title}" from a share link. It's now in your designer.`, 'success');
    } catch {
      this.toasts.show("This share link is damaged or incomplete, so it couldn't be opened.", 'error');
    }
    // Drop the long code from the address bar once it has been loaded.
    this.router.navigate([], { queryParams: { form: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
