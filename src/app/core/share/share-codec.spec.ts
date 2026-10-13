import { createField } from '../schema/field-factory';
import { emptySchema } from '../schema/form-schema';
import { decodeSchema, encodeSchema } from './share-codec';

describe('share codec', () => {
  const schema = { ...emptySchema('Shared ✓ form'), fields: [createField('select'), createField('textarea')] };

  it('round-trips a schema through a URL-safe string', async () => {
    const code = await encodeSchema(schema);
    expect(code).toMatch(/^[zj]\.[A-Za-z0-9_-]+$/);
    expect(await decodeSchema(code)).toEqual(schema);
  });

  it('compresses, so links stay short', async () => {
    const code = await encodeSchema(schema);
    expect(code.length).toBeLessThan(JSON.stringify(schema).length);
  });

  it('rejects strings that are not Formloom links', async () => {
    await expectAsync(decodeSchema('hello')).toBeRejectedWithError(/not a Formloom link/);
  });
});
