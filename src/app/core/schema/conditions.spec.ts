import { evaluateRule, computeVisibleFieldIds } from './conditions';
import { createField } from './field-factory';
import { FormSchema, VisibilityRule, emptySchema } from './form-schema';

const rule = (operator: VisibilityRule['operator'], value = ''): VisibilityRule => ({ fieldId: 'x', operator, value });

describe('evaluateRule', () => {
  it('compares text case- and whitespace-insensitively', () => {
    expect(evaluateRule(rule('equals', 'Yes'), ' yes ')).toBeTrue();
    expect(evaluateRule(rule('notEquals', 'yes'), 'no')).toBeTrue();
    expect(evaluateRule(rule('contains', 'ang'), 'Angular')).toBeTrue();
    expect(evaluateRule(rule('contains', ''), 'Angular')).toBeFalse();
  });

  it('treats null, empty string and false as empty', () => {
    for (const v of [null, undefined, '', false]) expect(evaluateRule(rule('isEmpty'), v)).toBeTrue();
    expect(evaluateRule(rule('isNotEmpty'), 0)).toBeTrue();
  });

  it('compares numbers and never matches blanks or non-numbers', () => {
    expect(evaluateRule(rule('greaterThan', '5'), 6)).toBeTrue();
    expect(evaluateRule(rule('lessThan', '5'), '4')).toBeTrue();
    expect(evaluateRule(rule('greaterThan', '5'), null)).toBeFalse();
    expect(evaluateRule(rule('greaterThan', 'abc'), 6)).toBeFalse();
  });

  it('handles checkboxes', () => {
    expect(evaluateRule(rule('isChecked'), true)).toBeTrue();
    expect(evaluateRule(rule('isChecked'), 'true')).toBeFalse();
    expect(evaluateRule(rule('isNotChecked'), false)).toBeTrue();
  });
});

describe('computeVisibleFieldIds', () => {
  function chain(): FormSchema {
    const a = { ...createField('checkbox'), key: 'a' };
    const b = { ...createField('text'), key: 'b', visibleWhen: { fieldId: a.id, operator: 'isChecked' as const, value: '' } };
    const c = { ...createField('text'), key: 'c', visibleWhen: { fieldId: b.id, operator: 'isNotEmpty' as const, value: '' } };
    return { ...emptySchema(), fields: [a, b, c] };
  }

  it('shows fields whose rule holds', () => {
    const s = chain();
    const visible = computeVisibleFieldIds(s, { a: true, b: 'hello', c: '' });
    expect(s.fields.every((f) => visible.has(f.id))).toBeTrue();
  });

  it('hides a whole chain when an upstream field is hidden', () => {
    const s = chain();
    // b still holds a stale value, but because a is unchecked, b is hidden and so is c.
    const visible = computeVisibleFieldIds(s, { a: false, b: 'stale', c: '' });
    expect([...visible]).toEqual([s.fields[0].id]);
  });

  it('ignores rules that point at deleted fields', () => {
    const f = { ...createField('text'), visibleWhen: { fieldId: 'gone', operator: 'isChecked' as const, value: '' } };
    expect(computeVisibleFieldIds({ ...emptySchema(), fields: [f] }, {}).has(f.id)).toBeTrue();
  });
});
