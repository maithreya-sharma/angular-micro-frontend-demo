import { createField, toOptionValue } from '../schema/field-factory';
import { FieldType, FieldValidation, FormField, FormSchema, emptySchema } from '../schema/form-schema';

export interface FormTemplate {
  id: string;
  name: string;
  summary: string;
  build: () => FormSchema;
}

/** Small builder so templates read like a description of the form. */
type FieldPatch = Omit<Partial<FormField>, 'validation'> & { validation?: Partial<FieldValidation> };

function field(type: FieldType, key: string, label: string, patch: FieldPatch = {}): FormField {
  const base = createField(type);
  return {
    ...base,
    key,
    label,
    ...patch,
    validation: { ...base.validation, ...patch.validation },
  };
}

const options = (...labels: string[]) => labels.map((label) => ({ label, value: toOptionValue(label) }));

function jobApplication(): FormSchema {
  const employed = field('checkbox', 'currentlyEmployed', 'I am currently employed', { defaultValue: false });
  const role = field('radio', 'role', 'Role you are applying for', {
    options: options('Frontend engineer', 'Backend engineer', 'QA engineer'),
    validation: { required: true },
  });
  return {
    ...emptySchema('Job application'),
    description: 'Tell us a little about yourself. It takes about two minutes.',
    submitLabel: 'Send application',
    fields: [
      field('text', 'fullName', 'Full name', {
        width: 'half',
        placeholder: 'Jane Doe',
        validation: { required: true, minLength: 2, maxLength: 80 },
      }),
      field('email', 'email', 'Email', {
        width: 'half',
        placeholder: 'jane@example.com',
        validation: { required: true },
      }),
      role,
      field('select', 'framework', 'Strongest frontend framework', {
        options: options('Angular', 'React', 'Vue', 'Svelte'),
        visibleWhen: { fieldId: role.id, operator: 'equals', value: 'frontend-engineer' },
      }),
      field('number', 'experience', 'Years of experience', {
        width: 'half',
        validation: { required: true, min: 0, max: 50 },
      }),
      field('date', 'startDate', 'Earliest start date', { width: 'half' }),
      employed,
      field('number', 'noticePeriod', 'Notice period (days)', {
        helpText: 'Only needed if you are currently employed.',
        validation: { required: true, min: 0, max: 180 },
        visibleWhen: { fieldId: employed.id, operator: 'isChecked', value: '' },
      }),
      field('text', 'portfolio', 'Portfolio or GitHub URL', {
        placeholder: 'https://github.com/…',
        validation: {
          pattern: '^https?://\\S+$',
          patternMessage: 'Start the link with http:// or https://',
        },
      }),
      field('textarea', 'motivation', 'Why this role?', {
        validation: { maxLength: 600 },
      }),
      field('checkbox', 'consent', 'I agree to my data being stored for this application', {
        validation: { required: true },
      }),
    ],
  };
}

function eventRsvp(): FormSchema {
  const attending = field('radio', 'attending', 'Will you attend?', {
    options: options('Yes', 'No', 'Maybe'),
    validation: { required: true },
  });
  const guests = field('number', 'guests', 'Number of guests (including you)', {
    defaultValue: 1,
    validation: { required: true, min: 1, max: 6 },
    visibleWhen: { fieldId: attending.id, operator: 'equals', value: 'yes' },
  });
  return {
    ...emptySchema('Team offsite RSVP'),
    description: 'Let us know if you can make it by Friday.',
    submitLabel: 'Send RSVP',
    fields: [
      field('text', 'name', 'Your name', { validation: { required: true } }),
      attending,
      guests,
      field('select', 'meal', 'Meal preference', {
        options: options('Vegetarian', 'Vegan', 'Non-vegetarian', 'Jain'),
        visibleWhen: { fieldId: attending.id, operator: 'equals', value: 'yes' },
      }),
      field('textarea', 'reason', 'Anything we can do to help you attend?', {
        visibleWhen: { fieldId: attending.id, operator: 'equals', value: 'maybe' },
      }),
    ],
  };
}

function bugReport(): FormSchema {
  const platform = field('radio', 'platform', 'Platform', {
    options: options('Web', 'Android', 'iOS'),
    validation: { required: true },
  });
  return {
    ...emptySchema('Bug report'),
    description: 'Found something broken? Help us reproduce it.',
    submitLabel: 'File bug',
    fields: [
      field('text', 'summary', 'Summary', {
        placeholder: 'Checkout button does nothing on Safari',
        validation: { required: true, maxLength: 120 },
      }),
      platform,
      field('select', 'browser', 'Browser', {
        options: options('Chrome', 'Firefox', 'Safari', 'Edge'),
        visibleWhen: { fieldId: platform.id, operator: 'equals', value: 'web' },
      }),
      field('text', 'appVersion', 'App version', {
        placeholder: '4.12.0',
        visibleWhen: { fieldId: platform.id, operator: 'notEquals', value: 'web' },
        validation: { pattern: '^\\d+\\.\\d+\\.\\d+$', patternMessage: 'Use the format 1.2.3' },
      }),
      field('select', 'severity', 'Severity', {
        width: 'half',
        options: options('Blocker', 'Major', 'Minor', 'Cosmetic'),
        validation: { required: true },
      }),
      field('email', 'reporter', 'Your email', { width: 'half' }),
      field('textarea', 'steps', 'Steps to reproduce', {
        placeholder: '1. Go to …\n2. Click …',
        validation: { required: true, minLength: 20 },
      }),
    ],
  };
}

export const TEMPLATES: FormTemplate[] = [
  { id: 'job-application', name: 'Job application', summary: 'Conditional notice period, URL pattern, consent', build: jobApplication },
  { id: 'event-rsvp', name: 'Event RSVP', summary: 'Guest count and meal choice shown only if attending', build: eventRsvp },
  { id: 'bug-report', name: 'Bug report', summary: 'Platform-specific questions and version format', build: bugReport },
  { id: 'blank', name: 'Blank form', summary: 'Start from scratch', build: () => emptySchema() },
];
