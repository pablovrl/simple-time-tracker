import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Card } from '../../components/card/card';
import { Project, ProjectsService } from '../../services/projects.service';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-projects',
  imports: [Card, MoneyPipe],
  templateUrl: './projects.html',
})
export class Projects implements OnInit {
  private readonly service = inject(ProjectsService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);

  ngOnInit() {
    this.loadProjects();
  }

  protected loadProjects(page = this.page()) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.service.list(page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ projects, pagination }) => {
        this.projects.set(projects);
        this.page.set(pagination.page);
        this.hasMore.set(pagination.hasMore);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
