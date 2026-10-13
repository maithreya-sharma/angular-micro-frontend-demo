import { ConditionOperator, FieldType } from './form-schema';

/** Which inspector controls make sense for a field type. */
export interface FieldCapabilities {
  placeholder: boolean;
  length: boolean;
  range: boolean;
  pattern: boolean;
  options: boolean;
}

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  /** One or two characters rendered as the palette glyph. */
  glyph: string;
  hint: string;
  capabilities: FieldCapabilities;
}

const none: FieldCapabilities = { placeholder: false, length: false, range: false, pattern: false, options: false };

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  text: {
    type: 'text',
    label: 'Short text',
    glyph: 'Aa',
    hint: 'Names, titles, one-line answers',
    capabilities: { ...none, placeholder: true, length: true, pattern: true },
  },
  textarea: {
    type: 'textarea',
    label: 'Paragraph',
    glyph: '¶',
    hint: 'Longer, multi-line answers',
    capabilities: { ...none, placeholder: true, length: true },
  },
  email: {
    type: 'email',
    label: 'Email',
    glyph: '@',
    hint: 'Validated email address',
    capabilities: { ...none, placeholder: true, pattern: true },
  },
  number: {
    type: 'number',
    label: 'Number',
    glyph: '#',
    hint: 'Quantities, ages, amounts',
    capabilities: { ...none, placeholder: true, range: true },
  },
  date: {
    type: 'date',
    label: 'Date',
    glyph: '▦',
    hint: 'Calendar date picker',
    capabilities: { ...none },
  },
  select: {
    type: 'select',
    label: 'Dropdown',
    glyph: '▾',
    hint: 'Pick one from a long list',
    capabilities: { ...none, options: true },
  },
  radio: {
    type: 'radio',
    label: 'Single choice',
    glyph: '◉',
    hint: 'Pick one from a few options',
    capabilities: { ...none, options: true },
  },
  checkbox: {
    type: 'checkbox',
    label: 'Checkbox',
    glyph: '☑',
    hint: 'Yes/no, consent, opt-in',
    capabilities: { ...none },
  },
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  contains: 'contains',
  isEmpty: 'is empty',
  isNotEmpty: 'is filled in',
  greaterThan: 'is greater than',
  lessThan: 'is less than',
  isChecked: 'is checked',
  isNotChecked: 'is not checked',
};

/** Operators that don't need a comparison value. */
export const UNARY_OPERATORS: ReadonlySet<ConditionOperator> = new Set([
  'isEmpty',
  'isNotEmpty',
  'isChecked',
  'isNotChecked',
]);

/** Operators that make sense when the rule depends on a field of this type. */
export function operatorsFor(type: FieldType): ConditionOperator[] {
  switch (type) {
    case 'checkbox':
      return ['isChecked', 'isNotChecked'];
    case 'number':
      return ['equals', 'notEquals', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty'];
    case 'select':
    case 'radio':
      return ['equals', 'notEquals', 'isEmpty', 'isNotEmpty'];
    default:
      return ['equals', 'notEquals', 'contains', 'isEmpty', 'isNotEmpty'];
  }
}
