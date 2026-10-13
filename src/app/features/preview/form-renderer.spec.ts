import { ComponentFixture, TestBed } from '@angular/core/testing';

import { createField } from '../../core/schema/field-factory';
import { FormSchema, emptySchema } from '../../core/schema/form-schema';
import { FormRenderer } from './form-renderer';

describe('FormRenderer', () => {
  let fixture: ComponentFixture<FormRenderer>;
  let el: HTMLElement;
  let submitted: Record<string, unknown>[];

  function schema(): FormSchema {
    const name = { ...createField('text'), key: 'name', label: 'Name' };
    name.validation = { ...name.validation, required: true };
    const plusOne = { ...createField('checkbox'), key: 'plusOne', label: 'Bringing a guest?' };
    const guest = { ...createField('text'), key: 'guest', label: 'Guest name' };
    guest.validation = { ...guest.validation, required: true };
    guest.visibleWhen = { fieldId: plusOne.id, operator: 'isChecked', value: '' };
    return { ...emptySchema('RSVP'), submitLabel: 'Send', fields: [name, plusOne, guest] };
  }

  const input = (key: string) => el.querySelector<HTMLInputElement>(`[data-key="${key}"] input`)!;
  const type = (key: string, value: string) => {
    input(key).value = value;
    input(key).dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(FormRenderer);
    fixture.componentRef.setInput('schema', schema());
    submitted = [];
    fixture.componentInstance.submitted.subscribe((v) => submitted.push(v));
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders visible fields only, with the custom submit label', () => {
    expect(el.querySelector('[data-key="name"]')).not.toBeNull();
    expect(el.querySelector('[data-key="guest"]')).toBeNull();
    expect(el.querySelector('[data-testid="submit"]')?.textContent?.trim()).toBe('Send');
  });

  it('reveals a conditional field when its rule is met', async () => {
    input('plusOne').click();
    await fixture.whenStable();
    expect(el.querySelector('[data-key="guest"]')).not.toBeNull();
  });

  it('blocks an invalid submit and explains why', async () => {
    (el.querySelector('[data-testid="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(submitted).toEqual([]);
    expect(el.querySelector('[data-testid="error-summary"]')?.textContent).toContain('1 field needs attention');
    expect(el.querySelector('[data-key="name"] .error')?.textContent).toContain('required');
  });

  it('submits only the values of visible fields', async () => {
    type('name', 'Ada');
    (el.querySelector('[data-testid="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(submitted).toEqual([{ name: 'Ada', plusOne: false }]);
  });
});
