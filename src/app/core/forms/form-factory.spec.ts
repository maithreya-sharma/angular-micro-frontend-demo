import { createField } from '../schema/field-factory';
import { FormField, FormSchema, emptySchema } from '../schema/form-schema';
import { buildForm, errorMessage, watchVisibility } from './form-factory';

function schemaWith(...fields: FormField[]): FormSchema {
  return { ...emptySchema(), fields };
}

describe('buildForm', () => {
  it('creates one control per field with type-appropriate initial values', () => {
    const text = { ...createField('text'), key: 'name', defaultValue: 'Ada' };
    const num = { ...createField('number'), key: 'age', defaultValue: '42' };
    const check = { ...createField('checkbox'), key: 'ok' };
    const form = buildForm(schemaWith(text, num, check));
    expect(form.getRawValue()).toEqual({ name: 'Ada', age: 42, ok: false });
  });

  it('applies validators from the schema', () => {
    const f = createField('text');
    f.key = 'code';
    f.validation = { ...f.validation, required: true, minLength: 3, pattern: '^[A-Z]+$' };
    const control = buildForm(schemaWith(f)).controls['code'];

    expect(control.hasError('required')).toBeTrue();
    control.setValue('AB');
    expect(control.hasError('minlength')).toBeTrue();
    control.setValue('abc');
    expect(control.hasError('pattern')).toBeTrue();
    control.setValue('ABC');
    expect(control.valid).toBeTrue();
  });

  it('requires a ticked box when a checkbox is required', () => {
    const f = { ...createField('checkbox'), key: 'consent' };
    f.validation = { ...f.validation, required: true };
    const control = buildForm(schemaWith(f)).controls['consent'];
    expect(control.valid).toBeFalse();
    control.setValue(true);
    expect(control.valid).toBeTrue();
  });

  it('never crashes on an invalid pattern', () => {
    const f = createField('text');
    f.validation = { ...f.validation, pattern: '([' };
    expect(() => buildForm(schemaWith(f))).not.toThrow();
  });
});

describe('watchVisibility', () => {
  it('disables hidden fields so they skip validation and are left out of the value', () => {
    const toggle = { ...createField('checkbox'), key: 'employed' };
    const notice = { ...createField('number'), key: 'notice' };
    notice.validation = { ...notice.validation, required: true };
    notice.visibleWhen = { fieldId: toggle.id, operator: 'isChecked', value: '' };
    const schema = schemaWith(toggle, notice);
    const form = buildForm(schema);
    let visible = new Set<string>();

    const sub = watchVisibility(form, schema, (ids) => (visible = ids));

    expect(visible.has(notice.id)).toBeFalse();
    expect(form.valid).withContext('hidden required field must not block submit').toBeTrue();
    expect(form.value).toEqual({ employed: false });

    form.controls['employed'].setValue(true);
    expect(visible.has(notice.id)).toBeTrue();
    expect(form.valid).toBeFalse();

    sub.unsubscribe();
  });
});

describe('errorMessage', () => {
  it('uses the custom pattern message when there is one', () => {
    const f = createField('text');
    f.validation = { ...f.validation, pattern: 'x', patternMessage: 'Use the format 1.2.3' };
    expect(errorMessage(f, { pattern: {} })).toBe('Use the format 1.2.3');
    expect(errorMessage(f, null)).toBeNull();
  });
});
