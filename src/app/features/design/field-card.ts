import { Component, computed, input, output } from '@angular/core';

import { FIELD_TYPE_META, OPERATOR_LABELS, UNARY_OPERATORS } from '../../core/schema/field-types';
import { FormField } from '../../core/schema/form-schema';

/**
 * A field as it appears on the canvas: a non-interactive sketch of the real
 * control plus everything a designer needs at a glance (key, rules, problems).
 */
@Component({
  selector: 'fl-field-card',
  templateUrl: './field-card.html',
  styleUrl: './field-card.scss',
  host: {
    '[class.is-selected]': 'selected()',
    '[class.is-half]': "field().width === 'half'",
  },
})
export class FieldCard {
  readonly field = input.required<FormField>();
  readonly selected = input(false);
  readonly issues = input<{ errors: number; warnings: number }>();
  /** The field this one's visibility rule depends on, if any. */
  readonly source = input<FormField>();
  readonly canMoveUp = input(true);
  readonly canMoveDown = input(true);

  readonly selectField = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly duplicate = output<void>();
  readonly remove = output<void>();

  protected readonly meta = computed(() => FIELD_TYPE_META[this.field().type]);

  protected readonly ruleText = computed(() => {
    const rule = this.field().visibleWhen;
    if (!rule) return null;
    const source = this.source();
    const name = source?.label || source?.key || 'a deleted field';
    const op = OPERATOR_LABELS[rule.operator];
    if (UNARY_OPERATORS.has(rule.operator)) return `Shown when "${name}" ${op}`;
    // Show the option's label rather than its stored value when there is one.
    const value = source?.options.find((o) => o.value === rule.value)?.label ?? rule.value;
    return `Shown when "${name}" ${op} "${value}"`;
  });

  protected readonly constraints = computed(() => {
    const v = this.field().validation;
    const parts: string[] = [];
    if (v.minLength !== null || v.maxLength !== null) parts.push(`${v.minLength ?? 0}–${v.maxLength ?? '∞'} chars`);
    if (v.min !== null || v.max !== null) parts.push(`${v.min ?? '−∞'} to ${v.max ?? '∞'}`);
    if (v.pattern) parts.push('pattern');
    return parts;
  });
}
