import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { toOptionValue } from '../../../core/schema/field-factory';
import { FIELD_TYPE_META, OPERATOR_LABELS, UNARY_OPERATORS, operatorsFor } from '../../../core/schema/field-types';
import { ConditionOperator, FieldValidation, FieldValue, FormField } from '../../../core/schema/form-schema';
import { BuilderStore } from '../../../core/state/builder-store';

/**
 * Edits the selected field, or the form's settings when nothing is selected.
 *
 * The inspector holds no state of its own. Every control reads from the
 * store's signals and writes back through store methods, so undo/redo, the
 * canvas, the preview and the JSON view all stay in sync for free.
 * Keystroke-level edits pass a coalesce key so one word is one undo step.
 */
@Component({
  selector: 'fl-inspector',
  imports: [NgTemplateOutlet],
  templateUrl: './inspector.html',
  styleUrl: './inspector.scss',
})
export class Inspector {
  protected readonly store = inject(BuilderStore);
  protected readonly operatorLabels = OPERATOR_LABELS;

  protected readonly field = this.store.selected;
  protected readonly meta = computed(() => {
    const f = this.field();
    return f ? FIELD_TYPE_META[f.type] : null;
  });

  protected readonly fieldIssues = computed(() => {
    const id = this.store.selectedId();
    return this.store.issues().filter((i) => i.fieldId === id);
  });

  protected readonly formIssues = computed(() =>
    this.store.issues().map((issue) => ({
      ...issue,
      label: this.store.fields().find((f) => f.id === issue.fieldId)?.label,
    })),
  );

  /** Only fields *above* this one can control it, which keeps rules acyclic and readable. */
  protected readonly ruleCandidates = computed(() => {
    const f = this.field();
    if (!f) return [];
    const fields = this.store.fields();
    return fields.slice(0, fields.findIndex((x) => x.id === f.id));
  });

  protected readonly ruleSource = computed(() => {
    const rule = this.field()?.visibleWhen;
    return rule ? (this.store.fields().find((f) => f.id === rule.fieldId) ?? null) : null;
  });

  protected readonly ruleOperators = computed(() => {
    const source = this.ruleSource();
    return source ? operatorsFor(source.type) : [];
  });

  protected readonly ruleNeedsValue = computed(() => {
    const rule = this.field()?.visibleWhen;
    return !!rule && !UNARY_OPERATORS.has(rule.operator);
  });

  // ---- Basic properties ----------------------------------------------------

  protected setLabel(label: string): void {
    this.store.renameField(this.id(), label);
  }

  protected set(patch: Partial<FormField>, coalesceKey?: string): void {
    this.store.updateField(this.id(), patch, coalesceKey);
  }

  protected setValidation(patch: Partial<FieldValidation>, coalesceKey?: string): void {
    const f = this.field();
    if (!f) return;
    this.store.updateField(f.id, { validation: { ...f.validation, ...patch } }, coalesceKey && `v:${coalesceKey}`);
  }

  protected setDefault(raw: string | boolean): void {
    const f = this.field();
    if (!f) return;
    let value: FieldValue = raw;
    if (f.type === 'number') value = toNumber(String(raw));
    else if (typeof raw === 'string' && raw === '') value = null;
    this.set({ defaultValue: value }, 'default');
  }

  /** Parse a number input: blank or invalid means "no limit". */
  protected num(raw: string): number | null {
    return toNumber(raw);
  }

  // ---- Options -------------------------------------------------------------

  /** While an option's value still matches its label, keep them in sync. */
  protected setOptionLabel(index: number, label: string): void {
    const f = this.field();
    if (!f) return;
    const options = f.options.map((o, i) => {
      if (i !== index) return o;
      const derived = o.value === toOptionValue(o.label);
      return { label, value: derived ? toOptionValue(label) : o.value };
    });
    this.set({ options }, `option-label-${index}`);
  }

  protected setOptionValue(index: number, value: string): void {
    const f = this.field();
    if (!f) return;
    this.set({ options: f.options.map((o, i) => (i === index ? { ...o, value } : o)) }, `option-value-${index}`);
  }

  protected addOption(): void {
    const f = this.field();
    if (!f) return;
    const label = `Option ${f.options.length + 1}`;
    this.set({ options: [...f.options, { label, value: toOptionValue(label) }] });
  }

  protected removeOption(index: number): void {
    const f = this.field();
    if (!f) return;
    this.set({ options: f.options.filter((_, i) => i !== index) });
  }

  // ---- Visibility rule -----------------------------------------------------

  protected setRuleSource(fieldId: string): void {
    const source = this.store.fields().find((f) => f.id === fieldId);
    if (!source) {
      this.set({ visibleWhen: null });
      return;
    }
    const operator = operatorsFor(source.type)[0];
    const value = source.options[0]?.value ?? '';
    this.set({ visibleWhen: { fieldId, operator, value: UNARY_OPERATORS.has(operator) ? '' : value } });
  }

  protected setRuleOperator(operator: string): void {
    const rule = this.field()?.visibleWhen;
    if (rule) this.set({ visibleWhen: { ...rule, operator: operator as ConditionOperator } });
  }

  protected setRuleValue(value: string): void {
    const rule = this.field()?.visibleWhen;
    if (rule) this.set({ visibleWhen: { ...rule, value } }, 'rule-value');
  }

  private id(): string {
    return this.store.selectedId() ?? '';
  }
}

function toNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
