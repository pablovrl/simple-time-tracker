import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.config';
import { TimeEntriesService } from './time-entries.service';

describe('TimeEntriesService deletion', () => {
  let service: TimeEntriesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: '/api' },
      ],
    });
    service = TestBed.inject(TimeEntriesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends authenticated DELETE and notifies subscribers after success', () => {
    const changed = vi.fn();
    service.changes.subscribe(changed);
    service.remove('entry').subscribe();
    const request = http.expectOne('/api/time-entries/entry');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does not emit updates when deletion fails', () => {
    const changed = vi.fn();
    const error = vi.fn();
    service.changes.subscribe(changed);
    service.remove('entry').subscribe({ error });
    http.expectOne('/api/time-entries/entry').flush({}, { status: 409, statusText: 'Conflict' });
    expect(changed).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
