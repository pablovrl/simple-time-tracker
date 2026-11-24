import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditEntry } from './edit-entry';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { TasksService } from '../../services/tasks.service';

describe('EditEntry', () => {
  const update = vi.fn();
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
    TestBed.configureTestingModule({
      imports: [EditEntry],
      providers: [
        { provide: TimeEntriesService, useValue: { update } },
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

  it('prefills local dates without losing milliseconds and keeps the current task', () => {
    const component = setup();
    const value = component['form'].getRawValue();
    expect(new Date(value.startedAt).toISOString()).toBe(entry.startedAt);
    expect(new Date(value.endedAt).toISOString()).toBe(entry.endedAt);
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
});
