import { FIELD_TYPE_META, UNARY_OPERATORS, operatorsFor } from './field-types';
import { newId } from './field-factory';
import {
  CONDITION_OPERATORS,
  ConditionOperator,
  FIELD_TYPES,
  FieldOption,
  FieldType,
  FieldValidation,
  FieldValue,
  FormField,
  FormSchema,
  VisibilityRule,
  emptyValidation,
} from './form-schema';

// ---------------------------------------------------------------------------
// Parsing: untrusted JSON (file import, pasted text, share links) → FormSchema
// ---------------------------------------------------------------------------

export interface ParseResult {
  schema: FormSchema | null;
  errors: string[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/**
 * Validate and normalize a schema from an untrusted source. Structural
 * problems become errors. Missing optional properties are filled with
 * defaults, so older or hand-written JSON still loads.
 */
export function parseSchema(input: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObj(input)) return { schema: null, errors: ['The JSON must be an object with a "fields" array.'] };
  if (!Array.isArray(input['fields'])) return { schema: null, errors: ['"fields" must be an array.'] };

  const fields: FormField[] = [];
  input['fields'].forEach((raw, i) => {
    const path = `fields[${i}]`;
    if (!isObj(raw)) {
      errors.push(`${path} must be an object.`);
      return;
    }
    const type = raw['type'];
    if (typeof type !== 'string' || !(FIELD_TYPES as readonly string[]).includes(type)) {
      errors.push(`${path}.type must be one of: ${FIELD_TYPES.join(', ')}.`);
      return;
    }
    const key = str(raw['key']);
    if (!key) {
      errors.push(`${path}.key is required.`);
      return;
    }
    fields.push(normalizeField(raw, type as FieldType, key, path, errors));
  });

  if (errors.length) return { schema: null, errors };
  return {
    schema: {
      version: 1,
      title: str(input['title'], 'Untitled form'),
      description: str(input['description']),
      submitLabel: str(input['submitLabel'], 'Submit') || 'Submit',
      fields,
    },
    errors: [],
  };
}

function normalizeField(raw: Obj, type: FieldType, key: string, path: string, errors: string[]): FormField {
  const v = isObj(raw['validation']) ? raw['validation'] : {};
  const validation: FieldValidation = {
    ...emptyValidation(),
    required: v['required'] === true,
    minLength: numOrNull(v['minLength']),
    maxLength: numOrNull(v['maxLength']),
    min: numOrNull(v['min']),
    max: numOrNull(v['max']),
    pattern: strOrNull(v['pattern']),
    patternMessage: strOrNull(v['patternMessage']),
  };

  const options: FieldOption[] = Array.isArray(raw['options'])
    ? raw['options'].filter(isObj).map((o) => ({ label: str(o['label']), value: str(o['value']) }))
    : [];

  let visibleWhen: VisibilityRule | null = null;
  if (isObj(raw['visibleWhen'])) {
    const r = raw['visibleWhen'];
    const op = r['operator'];
    if (typeof op === 'string' && (CONDITION_OPERATORS as readonly string[]).includes(op)) {
      visibleWhen = { fieldId: str(r['fieldId']), operator: op as ConditionOperator, value: str(r['value']) };
    } else {
      errors.push(`${path}.visibleWhen.operator must be one of: ${CONDITION_OPERATORS.join(', ')}.`);
    }
  }

  const dv = raw['defaultValue'];
  const defaultValue: FieldValue =
    typeof dv === 'string' || typeof dv === 'number' || typeof dv === 'boolean' ? dv : type === 'checkbox' ? false : null;

  return {
    id: str(raw['id']) || newId(),
    key,
    type,
    label: str(raw['label'], FIELD_TYPE_META[type].label),
    placeholder: str(raw['placeholder']),
    helpText: str(raw['helpText']),
    width: raw['width'] === 'half' ? 'half' : 'full',
    defaultValue,
    options,
    validation,
    visibleWhen,
  };
}

// ---------------------------------------------------------------------------
// Linting: a structurally valid schema can still be a broken form
// ---------------------------------------------------------------------------

export interface SchemaIssue {
  level: 'error' | 'warning';
  fieldId: string | null;
  message: string;
}

const KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function lintSchema(schema: FormSchema): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const error = (fieldId: string | null, message: string) => issues.push({ level: 'error', fieldId, message });
  const warn = (fieldId: string | null, message: string) => issues.push({ level: 'warning', fieldId, message });

  if (!schema.fields.length) warn(null, 'The form has no fields yet.');

  const keyCounts = new Map<string, number>();
  schema.fields.forEach((f) => keyCounts.set(f.key, (keyCounts.get(f.key) ?? 0) + 1));
  const position = new Map(schema.fields.map((f, i) => [f.id, i]));

  schema.fields.forEach((f, index) => {
    const name = `"${f.label || f.key}"`;
    const v = f.validation;

    if (!KEY_PATTERN.test(f.key)) error(f.id, `${name}: key "${f.key}" must start with a letter and use only letters, digits and _.`);
    if ((keyCounts.get(f.key) ?? 0) > 1) error(f.id, `${name}: key "${f.key}" is used by more than one field.`);
    if (!f.label.trim()) warn(f.id, `Field "${f.key}" has no label.`);

    if (v.minLength !== null && v.maxLength !== null && v.minLength > v.maxLength) {
      error(f.id, `${name}: min length is greater than max length.`);
    }
    if (v.min !== null && v.max !== null && v.min > v.max) error(f.id, `${name}: minimum is greater than maximum.`);
    if (v.pattern) {
      try {
        new RegExp(v.pattern);
      } catch {
        error(f.id, `${name}: the pattern is not a valid regular expression.`);
      }
    }

    if (FIELD_TYPE_META[f.type].capabilities.options) {
      if (f.options.length < 2) warn(f.id, `${name}: a choice field should have at least two options.`);
      const values = f.options.map((o) => o.value.trim());
      if (values.some((val) => !val)) error(f.id, `${name}: every option needs a value.`);
      if (new Set(values).size !== values.length) error(f.id, `${name}: option values must be unique.`);
    }

    const rule = f.visibleWhen;
    if (rule) {
      const sourceIndex = position.get(rule.fieldId);
      const source = sourceIndex === undefined ? undefined : schema.fields[sourceIndex];
      if (!source) error(f.id, `${name}: its visibility rule points at a field that no longer exists.`);
      else if (source.id === f.id) error(f.id, `${name}: a field can't depend on itself.`);
      else {
        if (sourceIndex! > index) warn(f.id, `${name}: it depends on a field further down the form, so it starts hidden.`);
        if (!operatorsFor(source.type).includes(rule.operator)) {
          warn(f.id, `${name}: "${rule.operator}" doesn't suit a ${FIELD_TYPE_META[source.type].label.toLowerCase()} field.`);
        }
        if (!UNARY_OPERATORS.has(rule.operator) && rule.value.trim() === '') {
          warn(f.id, `${name}: its visibility rule has no value to compare with.`);
        }
      }
    }
  });

  return issues;
}
