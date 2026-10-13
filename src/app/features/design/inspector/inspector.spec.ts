import { ComponentFixture, TestBed } from '@angular/core/testing';

import { emptySchema } from '../../../core/schema/form-schema';
import { BUILDER_STORAGE_KEY, BuilderStore } from '../../../core/state/builder-store';
import { Inspector } from './inspector';

describe('Inspector', () => {
  let fixture: ComponentFixture<Inspector>;
  let store: BuilderStore;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: BUILDER_STORAGE_KEY, useValue: null }] });
    store = TestBed.inject(BuilderStore);
    store.load(emptySchema('Settings test'));
    fixture = TestBed.createComponent(Inspector);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  const typeInto = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('shows form settings when no field is selected', () => {
    expect(el.textContent).toContain('Form settings');
    expect(el.textContent).toContain('The form has no fields yet.');
  });

  it('edits the selected field through the store', async () => {
    store.addField('text');
    await fixture.whenStable();

    typeInto('[data-testid="prop-label"]', 'Company name');
    (el.querySelector('[data-testid="prop-required"]') as HTMLInputElement).click();
    await fixture.whenStable();

    expect(store.selected()).toEqual(
      jasmine.objectContaining({ label: 'Company name', key: 'companyName', validation: jasmine.objectContaining({ required: true }) }),
    );
  });

  it('only offers fields above the selected one as rule sources', async () => {
    const first = store.addField('checkbox');
    store.addField('text');
    await fixture.whenStable();

    const options = Array.from(el.querySelectorAll('[data-testid="rule-source"] option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Always', `Only when "${first.label}"…`]);
  });

  it('creates a rule with an operator that suits the source field', async () => {
    const first = store.addField('checkbox');
    const second = store.addField('text');
    await fixture.whenStable();

    const select = el.querySelector<HTMLSelectElement>('[data-testid="rule-source"]')!;
    select.value = first.id;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(store.fields().find((f) => f.id === second.id)?.visibleWhen).toEqual({
      fieldId: first.id,
      operator: 'isChecked',
      value: '',
    });
  });
});
