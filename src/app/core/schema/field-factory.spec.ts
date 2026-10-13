import { cloneField, createField, toKey, toOptionValue, uniqueKey } from './field-factory';

describe('field factory', () => {
  it('derives camelCase keys from labels', () => {
    expect(toKey('Date of birth')).toBe('dateOfBirth');
    expect(toKey('  E-mail address! ')).toBe('eMailAddress');
    expect(toKey('2nd choice')).toBe('f2ndChoice');
    expect(toKey('???')).toBe('field');
  });

  it('makes keys unique', () => {
    expect(uniqueKey('email', ['name'])).toBe('email');
    expect(uniqueKey('email', ['email', 'email2'])).toBe('email3');
  });

  it('derives option values from labels', () => {
    expect(toOptionValue('Non-vegetarian')).toBe('non-vegetarian');
    expect(toOptionValue('Frontend engineer')).toBe('frontend-engineer');
  });

  it('creates fields with sensible defaults per type', () => {
    const select = createField('select', ['dropdown']);
    expect(select.key).toBe('dropdown2');
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe(toOptionValue(select.options[0].label));

    const checkbox = createField('checkbox');
    expect(checkbox.defaultValue).toBeFalse();
    expect(checkbox.options).toEqual([]);
  });

  it('clones with a new id and a unique key', () => {
    const original = createField('text');
    const copy = cloneField(original, [original.key]);
    expect(copy.id).not.toBe(original.id);
    expect(copy.key).toBe(`${original.key}Copy`);
    expect(copy.validation).not.toBe(original.validation);
  });
});
