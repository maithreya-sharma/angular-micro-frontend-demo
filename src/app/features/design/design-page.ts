import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, inject } from '@angular/core';

import { FIELD_TYPE_META } from '../../core/schema/field-types';
import { FIELD_TYPES, FieldType, FormField } from '../../core/schema/form-schema';
import { BuilderStore } from '../../core/state/builder-store';
import { FieldCard } from './field-card';
import { Inspector } from './inspector/inspector';

@Component({
  selector: 'fl-design-page',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, FieldCard, Inspector],
  templateUrl: './design-page.html',
  styleUrl: './design-page.scss',
})
export class DesignPage {
  protected readonly store = inject(BuilderStore);
  protected readonly palette = FIELD_TYPES.map((t) => FIELD_TYPE_META[t]);

  /** Issue counts per field id, so each card can flag its own problems. */
  protected readonly issuesByField = computed(() => {
    const map = new Map<string, { errors: number; warnings: number }>();
    for (const issue of this.store.issues()) {
      if (!issue.fieldId) continue;
      const entry = map.get(issue.fieldId) ?? { errors: 0, warnings: 0 };
      if (issue.level === 'error') entry.errors++;
      else entry.warnings++;
      map.set(issue.fieldId, entry);
    }
    return map;
  });

  protected readonly fieldsById = computed(() => new Map(this.store.fields().map((f) => [f.id, f])));

  /** The palette is a source only: nothing can be dropped back into it. */
  protected readonly noDrop = () => false;

  protected drop(event: CdkDragDrop<FormField[], unknown, FieldType | FormField>): void {
    if (event.previousContainer === event.container) {
      this.store.moveField(event.previousIndex, event.currentIndex);
    } else {
      this.store.addField(event.item.data as FieldType, event.currentIndex);
    }
  }

  protected move(index: number, delta: number): void {
    this.store.moveField(index, index + delta);
  }
}
