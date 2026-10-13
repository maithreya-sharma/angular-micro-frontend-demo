import { FormSchema, VisibilityRule } from './form-schema';

const isBlank = (v: unknown) => v === null || v === undefined || v === '' || v === false;
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Does the rule hold for the current value of the field it depends on? */
export function evaluateRule(rule: VisibilityRule, value: unknown): boolean {
  switch (rule.operator) {
    case 'equals':
      return norm(value) === norm(rule.value);
    case 'notEquals':
      return norm(value) !== norm(rule.value);
    case 'contains':
      return norm(rule.value) !== '' && norm(value).includes(norm(rule.value));
    case 'isEmpty':
      return isBlank(value);
    case 'isNotEmpty':
      return !isBlank(value);
    case 'isChecked':
      return value === true;
    case 'isNotChecked':
      return value !== true;
    case 'greaterThan':
    case 'lessThan': {
      if (isBlank(value) || rule.value.trim() === '') return false;
      const a = Number(value);
      const b = Number(rule.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return rule.operator === 'greaterThan' ? a > b : a < b;
    }
  }
}

/**
 * Work out which fields are visible for the given values (keyed by field key).
 *
 * Fields are processed in order, and a field whose controlling field is
 * hidden is hidden too. That way chains like A → B → C collapse correctly.
 * A rule that points at a field that no longer exists is ignored, so the field
 * stays visible; the linter reports it separately.
 */
export function computeVisibleFieldIds(schema: FormSchema, values: Record<string, unknown>): Set<string> {
  const byId = new Map(schema.fields.map((f) => [f.id, f]));
  const visible = new Set<string>();

  for (const field of schema.fields) {
    const rule = field.visibleWhen;
    const source = rule ? byId.get(rule.fieldId) : undefined;
    if (!rule || !source || source.id === field.id) {
      visible.add(field.id);
      continue;
    }
    if (visible.has(source.id) && evaluateRule(rule, values[source.key])) {
      visible.add(field.id);
    }
  }
  return visible;
}
