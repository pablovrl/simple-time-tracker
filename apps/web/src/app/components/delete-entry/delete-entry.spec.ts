import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteEntry } from './delete-entry';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';

describe('DeleteEntry', () => {
  const remove = vi.fn();
  const entry: TimeEntry = {
    id: 'entry',
    taskId: 'task',
    description: 'Work',
    startedAt: '2026-11-24T09:00:00Z',
    endedAt: '2026-11-24T10:00:00Z',
    hourlyRate: '40',
    currency: 'USD',
    amount: '40',
  };

  beforeEach(() => {
    remove.mockReset();
    TestBed.configureTestingModule({
      imports: [DeleteEntry],
      providers: [{ provide: TimeEntriesService, useValue: { remove } }],
    });
    TestBed.overrideComponent(DeleteEntry, { set: { template: '' } });
  });

  it('waits for confirmation, prevents duplicate requests and allows retry after errors', () => {
    const response = new Subject<void>();
    remove.mockReturnValue(response);
    const fixture = TestBed.createComponent(DeleteEntry);
    fixture.componentRef.setInput('entry', entry);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(remove).not.toHaveBeenCalled();
    component['remove']();
    expect(remove).toHaveBeenCalledWith('entry');
    expect(component['deleting']()).toBe(true);
    component['remove']();
    expect(remove).toHaveBeenCalledTimes(1);
    response.error(new Error('offline'));
    expect(component['deleting']()).toBe(false);
    expect(component['error']()).toBe(true);
    remove.mockReturnValue(new Subject<void>());
    component['remove']();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(component['error']()).toBe(false);
  });

  it('refuses to delete a running entry', () => {
    const fixture = TestBed.createComponent(DeleteEntry);
    fixture.componentRef.setInput('entry', { ...entry, endedAt: null });
    fixture.detectChanges();
    fixture.componentInstance['remove']();
    expect(remove).not.toHaveBeenCalled();
  });
});
