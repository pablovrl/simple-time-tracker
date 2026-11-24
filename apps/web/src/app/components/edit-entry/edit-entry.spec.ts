import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditEntry } from './edit-entry';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { TasksService } from '../../services/tasks.service';

describe('EditEntry', () => {
  const update = vi.fn();
  const create = vi.fn();
  const entry: TimeEntry = {
    id: 'entry',
    taskId: 'task',
    taskTitle: 'Website',
    description: 'Original',
    startedAt: '2026-11-24T09:00:00.123Z',
    endedAt: '2026-11-24T10:00:00.456Z',
    hourlyRate: '40',
    currency: 'USD',
    amount: '40',
  };

  beforeEach(() => {
    update.mockReset();
    create.mockReset();
    TestBed.configureTestingModule({
      imports: [EditEntry],
      providers: [
        { provide: TimeEntriesService, useValue: { update, create } },
        { provide: TasksService, useValue: { list: () => of({ tasks: [] }) } },
      ],
    });
    // Exercise form behavior without the native dialog's browser animation API.
    TestBed.overrideComponent(EditEntry, { set: { template: '' } });
  });

  function setup() {
    const fixture = TestBed.createComponent(EditEntry);
    fixture.componentRef.setInput('entry', entry);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('copies start date and time to the end only when creating an entry', () => {
    const fixture = TestBed.createComponent(EditEntry);
    fixture.detectChanges();
    const form = fixture.componentInstance['form'];
    form.controls.startedAt.setValue('2026-11-25T14:30');
    expect(form.controls.endedAt.value).toBe('2026-11-25T14:30');
    form.controls.endedAt.setValue('2026-11-25T16:00');
    expect(form.controls.endedAt.value).toBe('2026-11-25T16:00');

    const editing = setup();
    const originalEnd = editing['form'].controls.endedAt.value;
    editing['form'].controls.startedAt.setValue('2026-11-24T08:00');
    expect(editing['form'].controls.endedAt.value).toBe(originalEnd);
  });

  it('prefills local dates to minute precision and keeps the current task', () => {
    const component = setup();
    const value = component['form'].getRawValue();
    expect(new Date(value.startedAt).toISOString()).toBe('2026-11-24T09:00:00.000Z');
    expect(new Date(value.endedAt).toISOString()).toBe('2026-11-24T10:00:00.000Z');
    expect(value.description).toBe('Original');
    expect(component['taskOptions']()).toEqual([{ value: 'task', label: 'Website' }]);
  });

  it('submits only changed fields and allows retry after failure', () => {
    const result = new Subject<{ timeEntry: TimeEntry }>();
    update.mockReturnValue(result);
    const component = setup();
    component['form'].patchValue({ description: 'Corrected' });
    component['save']();
    expect(update).toHaveBeenCalledWith('entry', { description: 'Corrected' });
    expect(component['saving']()).toBe(true);
    component['save']();
    expect(update).toHaveBeenCalledTimes(1);
    result.error(new Error('offline'));
    expect(component['saving']()).toBe(false);
    expect(component['error']()).toContain('unable to save');
  });

  it('blocks reversed dates before making a request', () => {
    const component = setup();
    component['form'].patchValue({ endedAt: '2026-11-23T00:00' });
    component['save']();
    expect(component['form'].invalid).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('creates a manual entry with local dates converted to ISO and no billing fields', () => {
    const result = new Subject<{ timeEntry: TimeEntry }>();
    create.mockReturnValue(result);
    const fixture = TestBed.createComponent(EditEntry);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].setValue({
      taskId: 'task',
      description: 'Manual',
      startedAt: '2026-11-24T09:00',
      endedAt: '2026-11-24T10:00',
    });
    component['save']();
    expect(create).toHaveBeenCalledWith({
      taskId: 'task',
      description: 'Manual',
      startedAt: new Date('2026-11-24T09:00').toISOString(),
      endedAt: new Date('2026-11-24T10:00').toISOString(),
    });
    expect(update).not.toHaveBeenCalled();
  });
});
