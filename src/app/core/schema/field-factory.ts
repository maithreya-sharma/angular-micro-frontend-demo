import { FIELD_TYPE_META } from './field-types';
import { FieldOption, FieldType, FormField, emptyValidation } from './form-schema';

let counter = 0;

/** Short, unique, URL-friendly id. Not security-sensitive. */
export function newId(): string {
  counter = (counter + 1) % 1_000_000;
  return `f${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** "Date of birth" → "dateOfBirth"; falls back to "field" when nothing usable is left. */
export function toKey(label: string): string {
  const words = label
    .normalize('NFKD')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean);
  if (!words.length) return 'field';
  const key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return /^[0-9]/.test(key) ? `f${key}` : key;
}

/** Make `base` unique among `taken` by appending 2, 3, … */
export function uniqueKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

/** "Non-vegetarian" → "non-vegetarian". Used to derive option values from labels. */
export function toOptionValue(label: string): string {
  return label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function defaultOptions(): FieldOption[] {
  return [1, 2, 3].map((n) => ({ label: `Option ${n}`, value: `option-${n}` }));
}

export function createField(type: FieldType, takenKeys: Iterable<string> = []): FormField {
  const meta = FIELD_TYPE_META[type];
  return {
    id: newId(),
    key: uniqueKey(toKey(meta.label), takenKeys),
    type,
    label: meta.label,
    placeholder: '',
    helpText: '',
    width: 'full',
    defaultValue: type === 'checkbox' ? false : null,
    options: meta.capabilities.options ? defaultOptions() : [],
    validation: emptyValidation(),
    visibleWhen: null,
  };
}

export function cloneField(field: FormField, takenKeys: Iterable<string>): FormField {
  const copy = structuredClone(field);
  return {
    ...copy,
    id: newId(),
    key: uniqueKey(`${field.key}Copy`, takenKeys),
    label: `${field.label} (copy)`,
  };
}
