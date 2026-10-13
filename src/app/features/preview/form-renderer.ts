import { Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { buildForm, errorMessage, watchVisibility } from '../../core/forms/form-factory';
import { FormField, FormSchema } from '../../core/schema/form-schema';

/**
 * Renders any FormSchema as a working Angular Reactive Form: validators,
 * conditional fields, error messages and submit handling.
 */
@Component({
  selector: 'fl-form-renderer',
  imports: [ReactiveFormsModule],
  templateUrl: './form-renderer.html',
  styleUrl: './form-renderer.scss',
  host: { '[class.is-narrow]': 'narrow()' },
})
export class FormRenderer {
  readonly schema = input.required<FormSchema>();
  /** Lay everything out in one column, as on a phone. */
  readonly narrow = input(false);
  readonly submitted = output<Record<string, unknown>>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly version = signal(0);

  /** A fresh FormGroup whenever the schema changes or the user resets the form. */
  protected readonly form = computed(() => {
    this.version();
    return buildForm(this.schema());
  });
  protected readonly visible = signal<ReadonlySet<string>>(new Set());
  protected readonly attempted = signal(false);

  constructor() {
    effect((onCleanup) => {
      const form = this.form();
      const sub = watchVisibility(form, this.schema(), (ids) => this.visible.set(ids));
      this.attempted.set(false);
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected id(field: FormField): string {
    return `fl-${field.id}`;
  }

  protected error(field: FormField): string | null {
    const control = this.form().controls[field.key];
    if (!control || control.disabled || control.valid) return null;
    return control.touched || this.attempted() ? errorMessage(field, control.errors) : null;
  }

  protected invalidCount(): number {
    return Object.values(this.form().controls).filter((c) => c.enabled && c.invalid).length;
  }

  protected submit(): void {
    const form = this.form();
    if (form.invalid) {
      this.attempted.set(true);
      form.markAllAsTouched();
      // Move focus to the first problem, like a well-behaved native form.
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('.control.ng-invalid, input.ng-invalid')?.focus());
      return;
    }
    // Disabled (hidden) fields are excluded from `value` automatically.
    this.submitted.emit(form.value as Record<string, unknown>);
  }

  reset(): void {
    this.version.update((v) => v + 1);
  }
}
