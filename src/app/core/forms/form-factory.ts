import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Subscription, startWith } from 'rxjs';

import { computeVisibleFieldIds } from '../schema/conditions';
import { FieldValue, FormField, FormSchema } from '../schema/form-schema';

export type DynamicForm = FormGroup<Record<string, FormControl<FieldValue>>>;

/** Translate a field's validation settings into Angular validators. */
export function validatorsFor(field: FormField): ValidatorFn[] {
  const v = field.validation;
  const validators: ValidatorFn[] = [];

  if (v.required) validators.push(field.type === 'checkbox' ? Validators.requiredTrue : Validators.required);
  if (field.type === 'email') validators.push(Validators.email);

  if (field.type === 'text' || field.type === 'textarea') {
    if (v.minLength !== null) validators.push(Validators.minLength(v.minLength));
    if (v.maxLength !== null) validators.push(Validators.maxLength(v.maxLength));
  }
  if (field.type === 'number') {
    if (v.min !== null) validators.push(Validators.min(v.min));
    if (v.max !== null) validators.push(Validators.max(v.max));
    validators.push(finiteNumber);
  }
  if (v.pattern && (field.type === 'text' || field.type === 'email')) {
    try {
      validators.push(Validators.pattern(new RegExp(v.pattern)));
    } catch {
      // Invalid patterns are reported by the linter; never crash the preview.
    }
  }
  return validators;
}

const finiteNumber: ValidatorFn = (c) =>
  c.value === null || c.value === '' || Number.isFinite(Number(c.value)) ? null : { number: true };

function initialValue(field: FormField): FieldValue {
  if (field.type === 'checkbox') return field.defaultValue === true;
  if (field.type === 'number') {
    return field.defaultValue === null || field.defaultValue === '' ? null : Number(field.defaultValue);
  }
  return field.defaultValue === null ? '' : String(field.defaultValue);
}

/** Build a typed Reactive Form for a schema. One control per field, keyed by `field.key`. */
export function buildForm(schema: FormSchema): DynamicForm {
  const controls: Record<string, FormControl<FieldValue>> = {};
  for (const field of schema.fields) {
    controls[field.key] = new FormControl<FieldValue>(initialValue(field), { validators: validatorsFor(field) });
  }
  return new FormGroup(controls);
}

/**
 * Keep control enablement in sync with the visibility rules.
 *
 * Hidden fields are *disabled* rather than just not rendered. Angular then
 * skips their validators and leaves them out of `form.value`, so a hidden
 * required field can't block submission or leak stale data.
 *
 * Calls `onChange` with the visible field ids every time they're recomputed.
 * Unsubscribe the returned subscription when the form is discarded.
 */
export function watchVisibility(
  form: DynamicForm,
  schema: FormSchema,
  onChange: (visible: Set<string>) => void,
): Subscription {
  return form.valueChanges.pipe(startWith(null)).subscribe(() => {
    const visible = computeVisibleFieldIds(schema, form.getRawValue());
    for (const field of schema.fields) {
      const control = form.controls[field.key];
      if (!control) continue;
      const shouldEnable = visible.has(field.id);
      if (shouldEnable && control.disabled) control.enable({ emitEvent: false });
      if (!shouldEnable && control.enabled) control.disable({ emitEvent: false });
    }
    form.updateValueAndValidity({ emitEvent: false });
    onChange(visible);
  });
}

/** Human-readable message for the first error on a control. */
export function errorMessage(field: FormField, errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  const v = field.validation;
  if (errors['required']) return field.type === 'checkbox' ? 'Please tick this box to continue.' : 'This field is required.';
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength']) return `Use at least ${v.minLength} characters.`;
  if (errors['maxlength']) return `Use at most ${v.maxLength} characters.`;
  if (errors['min']) return `Must be ${v.min} or more.`;
  if (errors['max']) return `Must be ${v.max} or less.`;
  if (errors['number']) return 'Enter a number.';
  if (errors['pattern']) return v.patternMessage || "This doesn't match the expected format.";
  return 'This value is not valid.';
}
