import { TestBed } from '@angular/core/testing';

import { emptySchema } from '../schema/form-schema';
import { BUILDER_STORAGE_KEY, BuilderStore } from './builder-store';

describe('BuilderStore', () => {
  let store: BuilderStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: BUILDER_STORAGE_KEY, useValue: null }] });
    store = TestBed.inject(BuilderStore);
    store.load(emptySchema());
  });

  const keys = () => store.fields().map((f) => f.key);

  it('starts from the job application template', () => {
    const fresh = TestBed.runInInjectionContext(() => new BuilderStore());
    expect(fresh.schema().title).toBe('Job application');
  });

  it('adds fields after the selection and selects the new field', () => {
    const a = store.addField('text');
    store.addField('email');
    store.select(a.id);
    const c = store.addField('number');
    expect(keys()).toEqual(['shortText', 'number', 'email']);
    expect(store.selectedId()).toBe(c.id);
  });

  it('moves fields', () => {
    store.addField('text');
    store.addField('email');
    store.addField('number');
    store.moveField(2, 0);
    expect(keys()).toEqual(['number', 'shortText', 'email']);
  });

  it('keeps the key in sync with the label until the key is customised', () => {
    const f = store.addField('text');
    store.renameField(f.id, 'First name');
    expect(store.selected()!.key).toBe('firstName');

    store.updateField(f.id, { key: 'given_name' });
    store.renameField(f.id, 'Given name');
    expect(store.selected()!.key).toBe('given_name');
  });

  it('removes a field and clears rules that depended on it', () => {
    const toggle = store.addField('checkbox');
    const dependent = store.addField('text');
    store.updateField(dependent.id, { visibleWhen: { fieldId: toggle.id, operator: 'isChecked', value: '' } });
    store.removeField(toggle.id);
    expect(store.fields().length).toBe(1);
    expect(store.fields()[0].visibleWhen).toBeNull();
  });

  it('duplicates a field right after the original', () => {
    const f = store.addField('select');
    store.addField('text');
    store.duplicateField(f.id);
    expect(keys()).toEqual(['dropdown', 'dropdownCopy', 'shortText']);
  });

  it('undoes and redoes changes', () => {
    store.addField('text');
    store.addField('email');
    store.undo();
    expect(keys()).toEqual(['shortText']);
    store.redo();
    expect(keys()).toEqual(['shortText', 'email']);
    expect(store.canRedo()).toBeFalse();
  });

  it('merges rapid edits to the same property into one undo step', () => {
    const f = store.addField('text');
    for (const label of ['F', 'Fi', 'Fir', 'First']) store.renameField(f.id, label);
    expect(store.selected()!.label).toBe('First');
    store.undo();
    expect(store.fields()[0].label).toBe('Short text');
  });

  it('clears the redo stack after a new change', () => {
    store.addField('text');
    store.undo();
    store.addField('email');
    expect(store.canRedo()).toBeFalse();
  });

  it('drops the selection when undo removes the selected field', () => {
    store.addField('text');
    store.undo();
    expect(store.selectedId()).toBeNull();
  });

  it('lints continuously', () => {
    const a = store.addField('text');
    const b = store.addField('text');
    store.updateField(b.id, { key: a.key });
    expect(store.errorCount()).toBe(2);
  });
});
