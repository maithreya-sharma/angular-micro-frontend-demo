import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { parseSchema } from '../../core/schema/schema-io';
import { BuilderStore } from '../../core/state/builder-store';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'fl-json-page',
  templateUrl: './json-page.html',
  styleUrl: './json-page.scss',
})
export class JsonPage {
  private readonly store = inject(BuilderStore);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly json = computed(() => JSON.stringify(this.store.schema(), null, 2));
  protected readonly fieldCount = computed(() => this.store.fields().length);
  protected readonly draft = signal('');
  protected readonly importErrors = signal<string[]>([]);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.json());
      this.toasts.show('Schema copied to the clipboard.', 'success');
    } catch {
      this.toasts.show("Couldn't copy. Select the text and copy it manually.", 'error');
    }
  }

  protected download(): void {
    const blob = new Blob([this.json()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(this.store.schema().title) || 'form'}.formloom.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected async readFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.draft.set(await file.text());
    this.importDraft();
  }

  protected importDraft(): void {
    let data: unknown;
    try {
      data = JSON.parse(this.draft());
    } catch (err) {
      this.importErrors.set([`This isn't valid JSON: ${(err as Error).message}`]);
      return;
    }
    const { schema, errors } = parseSchema(data);
    if (!schema) {
      this.importErrors.set(errors);
      return;
    }
    this.importErrors.set([]);
    this.draft.set('');
    this.store.load(schema);
    this.toasts.show(`Imported "${schema.title}" with ${schema.fields.length} fields. Press Ctrl+Z to undo.`, 'success');
    this.router.navigate(['/design']);
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
