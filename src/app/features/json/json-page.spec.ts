import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { emptySchema } from '../../core/schema/form-schema';
import { BUILDER_STORAGE_KEY, BuilderStore } from '../../core/state/builder-store';
import { JsonPage } from './json-page';

describe('JsonPage', () => {
  let fixture: ComponentFixture<JsonPage>;
  let store: BuilderStore;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BUILDER_STORAGE_KEY, useValue: null }],
    });
    store = TestBed.inject(BuilderStore);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    store.load(emptySchema('Exported'));
    fixture = TestBed.createComponent(JsonPage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  const paste = async (text: string) => {
    const area = el.querySelector<HTMLTextAreaElement>('[data-testid="import-input"]')!;
    area.value = text;
    area.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Import JSON')) as HTMLButtonElement).click();
    await fixture.whenStable();
  };

  it('shows the current schema as JSON', () => {
    expect(JSON.parse(el.querySelector('[data-testid="schema-json"]')!.textContent!).title).toBe('Exported');
  });

  it('explains why an import was rejected', async () => {
    await paste('{ "fields": [{ "type": "slider", "key": "x" }] }');
    expect(el.querySelector('[data-testid="import-errors"]')?.textContent).toContain('fields[0].type');
    expect(store.schema().title).toBe('Exported');
  });

  it('reports malformed JSON', async () => {
    await paste('{ not json');
    expect(el.querySelector('[data-testid="import-errors"]')?.textContent).toContain("isn't valid JSON");
  });

  it('imports a valid schema and makes it undoable', async () => {
    await paste('{ "title": "Imported", "fields": [{ "type": "email", "key": "contact" }] }');
    expect(store.schema().title).toBe('Imported');
    store.undo();
    expect(store.schema().title).toBe('Exported');
  });
});
