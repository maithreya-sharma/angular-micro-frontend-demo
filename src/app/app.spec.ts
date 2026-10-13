import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { BUILDER_STORAGE_KEY, BuilderStore } from './core/state/builder-store';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: BUILDER_STORAGE_KEY, useValue: null }],
    });
  });

  it('renders the three views and the form title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.tabs a')).map((a) => a.textContent?.trim())).toEqual(['Design', 'Preview', 'JSON']);
    expect(el.querySelector<HTMLInputElement>('.title__input')?.value).toBe('Job application');
  });

  it('undoes with Ctrl+Z, but not while typing in an input', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(BuilderStore);
    await fixture.whenStable();
    store.addField('text');
    const count = store.fields().length;

    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(store.fields().length).toBe(count);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(store.fields().length).toBe(count - 1);
  });
});
