/**
 * The form schema is the single source of truth for everything in Formloom.
 * The designer edits it, the preview renders a Reactive Form from it, and the
 * JSON view imports and exports it.
 */

export const FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
export type FieldWidth = 'full' | 'half';
export type FieldValue = string | number | boolean | null;

export interface FieldOption {
  label: string;
  value: string;
}

export const CONDITION_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'isEmpty',
  'isNotEmpty',
  'greaterThan',
  'lessThan',
  'isChecked',
  'isNotChecked',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/** "Show this field when <field> <operator> <value>". */
export interface VisibilityRule {
  fieldId: string;
  operator: ConditionOperator;
  value: string;
}

export interface FieldValidation {
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  pattern: string | null;
  patternMessage: string | null;
}

export interface FormField {
  /** Stable internal id. Rules reference fields by id, so renaming a key never breaks them. */
  id: string;
  /** Property name in the submitted value. */
  key: string;
  type: FieldType;
  label: string;
  placeholder: string;
  helpText: string;
  width: FieldWidth;
  defaultValue: FieldValue;
  options: FieldOption[];
  validation: FieldValidation;
  visibleWhen: VisibilityRule | null;
}

export interface FormSchema {
  version: 1;
  title: string;
  description: string;
  submitLabel: string;
  fields: FormField[];
}

export function emptyValidation(): FieldValidation {
  return {
    required: false,
    minLength: null,
    maxLength: null,
    min: null,
    max: null,
    pattern: null,
    patternMessage: null,
  };
}

export function emptySchema(title = 'Untitled form'): FormSchema {
  return { version: 1, title, description: '', submitLabel: 'Submit', fields: [] };
}
