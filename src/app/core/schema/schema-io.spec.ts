import { createField } from './field-factory';
import { FormField, emptySchema } from './form-schema';
import { lintSchema, parseSchema } from './schema-io';

describe('parseSchema', () => {
  it('rejects input that is not a schema', () => {
    expect(parseSchema(null).errors[0]).toContain('object');
    expect(parseSchema({ fields: 'nope' }).errors[0]).toContain('"fields" must be an array');
  });

  it('reports every structural problem with its path', () => {
    const { schema, errors } = parseSchema({
      fields: [{ type: 'slider', key: 'a' }, { type: 'text' }, { type: 'text', key: 'ok', visibleWhen: { operator: 'sometimes' } }],
    });
    expect(schema).toBeNull();
    expect(errors).toEqual([
      jasmine.stringContaining('fields[0].type'),
      jasmine.stringContaining('fields[1].key'),
      jasmine.stringContaining('fields[2].visibleWhen.operator'),
    ]);
  });

  it('fills in defaults so minimal, hand-written JSON loads', () => {
    const { schema } = parseSchema({ fields: [{ type: 'checkbox', key: 'agree' }] });
    const field = schema!.fields[0];
    expect(schema!.title).toBe('Untitled form');
    expect(field.id).toBeTruthy();
    expect(field.label).toBe('Checkbox');
    expect(field.defaultValue).toBeFalse();
    expect(field.validation.required).toBeFalse();
  });

  it('round-trips an exported schema unchanged', () => {
    const original = { ...emptySchema('Round trip'), fields: [createField('select'), createField('email')] };
    expect(parseSchema(JSON.parse(JSON.stringify(original))).schema).toEqual(original);
  });
});

describe('lintSchema', () => {
  const lint = (...fields: FormField[]) => lintSchema({ ...emptySchema(), fields });
  const messages = (...fields: FormField[]) => lint(...fields).map((i) => i.message);

  it('warns about an empty form', () => {
    expect(lint()[0]).toEqual(jasmine.objectContaining({ level: 'warning', fieldId: null }));
  });

  it('flags duplicate and invalid keys', () => {
    const a = { ...createField('text'), key: 'name' };
    const b = { ...createField('text'), key: 'name' };
    const c = { ...createField('text'), key: '1st' };
    const issues = lint(a, b, c);
    expect(issues.filter((i) => i.message.includes('used by more than one')).length).toBe(2);
    expect(issues.some((i) => i.fieldId === c.id && i.message.includes('must start with a letter'))).toBeTrue();
  });

  it('flags impossible validation settings and bad regexes', () => {
    const f = createField('text');
    f.validation = { ...f.validation, minLength: 10, maxLength: 2, pattern: '([' };
    const m = messages(f);
    expect(m.some((x) => x.includes('min length is greater'))).toBeTrue();
    expect(m.some((x) => x.includes('not a valid regular expression'))).toBeTrue();
  });

  it('flags choice fields with missing or duplicate option values', () => {
    const f = createField('radio');
    f.options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'a' },
      { label: 'C', value: '' },
    ];
    const m = messages(f);
    expect(m.some((x) => x.includes('unique'))).toBeTrue();
    expect(m.some((x) => x.includes('needs a value'))).toBeTrue();
  });

  it('checks visibility rules', () => {
    const later = createField('checkbox');
    const dangling = { ...createField('text'), visibleWhen: { fieldId: 'missing', operator: 'equals' as const, value: 'x' } };
    const forward = { ...createField('text'), visibleWhen: { fieldId: later.id, operator: 'isChecked' as const, value: '' } };
    const m = messages(dangling, forward, later);
    expect(m.some((x) => x.includes('no longer exists'))).toBeTrue();
    expect(m.some((x) => x.includes('further down'))).toBeTrue();
  });

  it('is quiet for a well-formed form', () => {
    expect(lint(createField('text'), createField('email'))).toEqual([]);
  });
});
