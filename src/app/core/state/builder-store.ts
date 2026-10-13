import { Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';

import { cloneField, createField, toKey, uniqueKey } from '../schema/field-factory';
import { FieldType, FormField, FormSchema } from '../schema/form-schema';
import { lintSchema, parseSchema } from '../schema/schema-io';
import { TEMPLATES } from './templates';

/** localStorage key for autosave. Provide `null` (e.g. in tests) to disable persistence. */
export const BUILDER_STORAGE_KEY = new InjectionToken<string | null>('BUILDER_STORAGE_KEY', {
  providedIn: 'root',
  factory: () => 'formloom.schema.v1',
});

const HISTORY_LIMIT = 100;
/** Edits to the same property within this window merge into one undo step. */
const COALESCE_MS = 800;

/**
 * Signal-based store for the form being designed.
 *
 * Every change goes through `commit()`, which snapshots the previous schema
 * for undo/redo. Schemas are immutable: each change produces a new object, so
 * history is a plain array of snapshots and `computed()` dependents (linting,
 * preview, JSON) recompute only when something actually changed.
 */
@Injectable({ providedIn: 'root' })
export class BuilderStore {
  private readonly storageKey = inject(BUILDER_STORAGE_KEY);

  private readonly state = signal<FormSchema>(this.restore());
  private readonly past = signal<FormSchema[]>([]);
  private readonly future = signal<FormSchema[]>([]);
  private lastCoalesce: { key: string; at: number } | null = null;

  readonly schema = this.state.asReadonly();
  readonly fields = computed(() => this.state().fields);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.fields().find((f) => f.id === this.selectedId()) ?? null);
  readonly issues = computed(() => lintSchema(this.state()));
  readonly errorCount = computed(() => this.issues().filter((i) => i.level === 'error').length);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  constructor() {
    effect(() => this.persist(this.state()));
  }

  // ---- Field operations ---------------------------------------------------

  /** Add a new field at `index` (default: after the selected field, or at the end) and select it. */
  addField(type: FieldType, index?: number): FormField {
    const fields = this.fields();
    const field = createField(type, fields.map((f) => f.key));
    const selectedIndex = fields.findIndex((f) => f.id === this.selectedId());
    const at = clamp(index ?? (selectedIndex >= 0 ? selectedIndex + 1 : fields.length), 0, fields.length);
    this.commit({ ...this.state(), fields: [...fields.slice(0, at), field, ...fields.slice(at)] });
    this.selectedId.set(field.id);
    return field;
  }

  moveField(from: number, to: number): void {
    const fields = [...this.fields()];
    if (from === to || from < 0 || from >= fields.length) return;
    const [moved] = fields.splice(from, 1);
    fields.splice(clamp(to, 0, fields.length), 0, moved);
    this.commit({ ...this.state(), fields });
  }

  /**
   * Patch a field. Pass a `coalesceKey` for keystroke-level edits (e.g. typing
   * a label) so a whole word becomes a single undo step.
   */
  updateField(id: string, patch: Partial<Omit<FormField, 'id'>>, coalesceKey?: string): void {
    const fields = this.fields().map((f) => (f.id === id ? { ...f, ...patch } : f));
    this.commit({ ...this.state(), fields }, coalesceKey ? `${id}:${coalesceKey}` : undefined);
  }

  /**
   * Change a label and, if the key was still derived from the old label,
   * update the key too. Keys follow labels until the user customizes them.
   */
  renameField(id: string, label: string): void {
    const field = this.fields().find((f) => f.id === id);
    if (!field) return;
    const others = this.fields().filter((f) => f.id !== id).map((f) => f.key);
    const keyWasDerived = field.key === uniqueKey(toKey(field.label), others);
    const patch: Partial<FormField> = { label };
    if (keyWasDerived) patch.key = uniqueKey(toKey(label), others);
    this.updateField(id, patch, 'label');
  }

  duplicateField(id: string): void {
    const fields = this.fields();
    const index = fields.findIndex((f) => f.id === id);
    if (index < 0) return;
    const copy = cloneField(fields[index], fields.map((f) => f.key));
    this.commit({ ...this.state(), fields: [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)] });
    this.selectedId.set(copy.id);
  }

  /** Remove a field and any visibility rules that depended on it. */
  removeField(id: string): void {
    const fields = this.fields();
    const index = fields.findIndex((f) => f.id === id);
    if (index < 0) return;
    const remaining = fields
      .filter((f) => f.id !== id)
      .map((f) => (f.visibleWhen?.fieldId === id ? { ...f, visibleWhen: null } : f));
    this.commit({ ...this.state(), fields: remaining });
    if (this.selectedId() === id) this.selectedId.set(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
  }

  select(id: string | null): void {
    this.selectedId.set(id);
  }

  // ---- Form-level operations ----------------------------------------------

  updateSettings(patch: Partial<Pick<FormSchema, 'title' | 'description' | 'submitLabel'>>, coalesceKey?: string): void {
    this.commit({ ...this.state(), ...patch }, coalesceKey ? `settings:${coalesceKey}` : undefined);
  }

  /** Replace the whole schema (template, import, share link). Undoable. */
  load(schema: FormSchema): void {
    this.commit(structuredClone(schema));
    this.selectedId.set(null);
  }

  loadTemplate(templateId: string): void {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) this.load(template.build());
  }

  // ---- History ------------------------------------------------------------

  undo(): void {
    const past = this.past();
    if (!past.length) return;
    this.future.update((f) => [this.state(), ...f]);
    this.state.set(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
    this.lastCoalesce = null;
    this.dropStaleSelection();
  }

  redo(): void {
    const [next, ...rest] = this.future();
    if (!next) return;
    this.past.update((p) => [...p, this.state()]);
    this.state.set(next);
    this.future.set(rest);
    this.lastCoalesce = null;
    this.dropStaleSelection();
  }

  private commit(next: FormSchema, coalesceKey?: string): void {
    const now = Date.now();
    const merge =
      coalesceKey !== undefined &&
      this.lastCoalesce?.key === coalesceKey &&
      now - this.lastCoalesce.at < COALESCE_MS &&
      this.past().length > 0;

    if (!merge) this.past.update((p) => [...p, this.state()].slice(-HISTORY_LIMIT));
    this.lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
    this.future.set([]);
    this.state.set(next);
  }

  private dropStaleSelection(): void {
    const id = this.selectedId();
    if (id && !this.fields().some((f) => f.id === id)) this.selectedId.set(null);
  }

  // ---- Persistence --------------------------------------------------------

  private restore(): FormSchema {
    try {
      const raw = this.storageKey ? localStorage.getItem(this.storageKey) : null;
      const parsed = raw ? parseSchema(JSON.parse(raw)).schema : null;
      if (parsed) return parsed;
    } catch {
      // Unavailable or corrupt storage: fall through to the starter template.
    }
    return TEMPLATES[0].build();
  }

  private persist(schema: FormSchema): void {
    try {
      if (this.storageKey) localStorage.setItem(this.storageKey, JSON.stringify(schema));
    } catch {
      // Autosave is best-effort.
    }
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
