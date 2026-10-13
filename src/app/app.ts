import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { encodeSchema } from './core/share/share-codec';
import { BuilderStore } from './core/state/builder-store';
import { TEMPLATES } from './core/state/templates';
import { ToastService } from './core/ui/toast.service';

const EDITABLE = 'input, textarea, select, [contenteditable="true"]';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  host: { '(document:keydown)': 'onKeydown($event)' },
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(BuilderStore);
  protected readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  protected readonly templates = TEMPLATES;
  protected readonly tabs = [
    { path: '/design', label: 'Design' },
    { path: '/preview', label: 'Preview' },
    { path: '/json', label: 'JSON' },
  ];

  protected readonly issueSummary = computed(() => {
    const issues = this.store.issues();
    const errors = issues.filter((i) => i.level === 'error').length;
    if (errors) return { tone: 'error', text: `${errors} ${errors === 1 ? 'problem' : 'problems'}` };
    if (issues.length) return { tone: 'warn', text: `${issues.length} ${issues.length === 1 ? 'suggestion' : 'suggestions'}` };
    return { tone: 'ok', text: 'Ready to use' };
  });

  protected rename(title: string): void {
    this.store.updateSettings({ title }, 'title');
  }

  protected useTemplate(select: HTMLSelectElement): void {
    const template = TEMPLATES.find((t) => t.id === select.value);
    select.value = '';
    if (!template) return;
    this.store.loadTemplate(template.id);
    this.toasts.show(`Loaded "${template.name}". Press Ctrl+Z to undo.`);
    this.router.navigate(['/design']);
  }

  /** Encode the whole form into the URL. No server, the link *is* the form. */
  protected async share(): Promise<void> {
    try {
      const code = await encodeSchema(this.store.schema());
      const tree = this.router.createUrlTree(['/preview'], { queryParams: { form: code } });
      const url = `${window.location.origin}${this.location.prepareExternalUrl(this.router.serializeUrl(tree))}`;
      await navigator.clipboard.writeText(url);
      this.toasts.show('Share link copied. Anyone with it can open this form.', 'success');
    } catch {
      this.toasts.show("Couldn't copy the link. Check clipboard permissions and try again.", 'error');
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest(EDITABLE)) return; // let inputs keep their native undo and delete
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      this.store.redo();
    } else if ((key === 'delete' || key === 'backspace') && this.store.selectedId() && this.router.url.startsWith('/design')) {
      event.preventDefault();
      this.store.removeField(this.store.selectedId()!);
    } else if (key === 'escape') {
      this.store.select(null);
    }
  }
}
