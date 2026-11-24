import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Entries } from './entries';
import { TimeEntriesService } from '../../services/time-entries.service';

describe('Entries pagination after deletion', () => {
  const history = vi.fn();
  let changes: Subject<void>;

  beforeEach(() => {
    history.mockReset();
    changes = new Subject<void>();
    TestBed.configureTestingModule({
      imports: [Entries],
      providers: [{ provide: TimeEntriesService, useValue: { history, changes } }],
    });
    TestBed.overrideComponent(Entries, { set: { template: '' } });
  });

  it('returns to the previous page when the last entry on a page is removed', () => {
    history.mockReturnValueOnce(
      of({
        timeEntries: [{ id: 'last-entry' }],
        pagination: { page: 2, hasMore: false },
      }),
    );
    const fixture = TestBed.createComponent(Entries);
    fixture.componentInstance['page'].set(2);
    fixture.detectChanges();
    history
      .mockReturnValueOnce(
        of({
          timeEntries: [],
          pagination: { page: 2, hasMore: false },
        }),
      )
      .mockReturnValueOnce(
        of({
          timeEntries: [{ id: 'previous-entry' }],
          pagination: { page: 1, hasMore: false },
        }),
      );
    changes.next();
    expect(history.mock.calls.map(([page]) => page)).toEqual([2, 2, 1]);
    expect(fixture.componentInstance['page']()).toBe(1);
    expect(fixture.componentInstance['entries']()).toEqual([{ id: 'previous-entry' }]);
  });
});
