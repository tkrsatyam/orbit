import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GroupResponse, GroupService, GroupPageResponse } from '../../core/services/group.service';
import { DiscoverComponent } from './discover.component';

describe('DiscoverComponent', () => {
  let component: DiscoverComponent;
  let fixture: ComponentFixture<DiscoverComponent>;
  let router: Router;

  let authServiceMock: {
    isLoading: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };

  let groupServiceMock: {
    discoverGroups: ReturnType<typeof vi.fn>;
    joinPublicGroup: ReturnType<typeof vi.fn>;
    loadMyGroups: ReturnType<typeof vi.fn>;
    myGroups: ReturnType<typeof signal<GroupResponse[]>>;
  };

  const mockPublicGroups: GroupResponse[] = [
    {
      id: 'grp-1',
      name: 'Spring Boot Ninjas',
      description: 'Java and Spring Boot architecture discussions',
      topicTag: 'java-spring',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 42,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    },
    {
      id: 'grp-2',
      name: 'LeetCode Grinders',
      description: 'Daily mock interviews and algorithm practice',
      topicTag: '#interview-prep, #dsa',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 15,
      conversationId: 'conv-2',
      createdAt: '2026-10-21T11:00:00Z',
      role: null as any
    }
  ];

  const mockPageResponse: GroupPageResponse = {
    content: mockPublicGroups,
    page: 0,
    size: 50,
    totalElements: 2,
    totalPages: 1,
    last: true
  };

  beforeEach(async () => {
    authServiceMock = {
      isLoading: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(true),
      currentUser: vi.fn().mockReturnValue({ displayName: 'Satyam Kumar', email: 'satyam@orbit.local' })
    };

    groupServiceMock = {
      discoverGroups: vi.fn().mockReturnValue(of(mockPageResponse)),
      joinPublicGroup: vi.fn().mockReturnValue(of({ groupId: 'grp-2', conversationId: 'conv-2', role: 'MEMBER' })),
      loadMyGroups: vi.fn().mockReturnValue(of([])),
      myGroups: signal<GroupResponse[]>([])
    };

    await TestBed.configureTestingModule({
      imports: [DiscoverComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: GroupService, useValue: groupServiceMock }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(DiscoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and dynamically compute topic filters from public groups', () => {
    expect(component).toBeTruthy();
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({ page: 0, size: 100 });
    expect(component.groups().length).toBe(2);

    // Dynamic filters computed from mockPublicGroups ('java-spring', 'interview-prep', 'dsa')
    const filters = component.topicFilters();
    expect(filters.length).toBeGreaterThan(1);
    expect(filters[0].label).toBe('All Topics');
    const labels = filters.map(f => f.label);
    expect(labels).toContain('#java-spring');
    expect(labels).toContain('#interview-prep');
    expect(labels).toContain('#dsa');
  });

  it('should debounce search input before calling API', () => {
    vi.useFakeTimers();
    groupServiceMock.discoverGroups.mockClear();

    // Type 6 letters rapidly
    component.onSearchInput('D');
    component.onSearchInput('De');
    component.onSearchInput('Des');
    component.onSearchInput('Desi');
    component.onSearchInput('Desig');
    component.onSearchInput('Design');

    // Should NOT have called discoverGroups yet before debounce elapsed
    expect(groupServiceMock.discoverGroups).not.toHaveBeenCalled();

    // Advance virtual clock past debounce timer (300ms)
    vi.advanceTimersByTime(300);

    // Called only ONCE with the final search query!
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledTimes(1);
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({ q: 'Design', tag: undefined, page: 0, size: 50 });

    vi.useRealTimers();
  });

  it('should filter groups when selecting topic tag chip', () => {
    component.selectTag('interview-prep');

    expect(component.selectedTag()).toBe('interview-prep');
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({ q: '', tag: 'interview-prep', page: 0, size: 50 });
  });

  it('should clear search input and reload groups immediately', () => {
    component.searchQuery.set('Something');
    component.clearSearch();

    expect(component.searchQuery()).toBe('');
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({ q: '', tag: undefined, page: 0, size: 50 });
  });

  it('should render Open Space for joined groups and route to /groups/:id', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.space-card');

    const openBtn = cards[0].querySelector('.btn-card-joined') as HTMLButtonElement;
    expect(openBtn).not.toBeNull();
    expect(openBtn.textContent).toContain('Open Space');

    openBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/groups', 'grp-1']);
  });

  it('should render Join Space for unjoined group and call joinPublicGroup', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.space-card');

    const joinBtn = cards[1].querySelector('.btn-card-join') as HTMLButtonElement;
    expect(joinBtn).not.toBeNull();
    expect(joinBtn.textContent).toContain('Join Space');

    joinBtn.click();
    expect(groupServiceMock.joinPublicGroup).toHaveBeenCalledWith('grp-2');

    const updated = component.groups().find(g => g.id === 'grp-2');
    expect(updated?.role).toBe('MEMBER');
    expect(updated?.memberCount).toBe(16);
  });

  it('should prompt guests to login when clicking Join Space', () => {
    authServiceMock.isAuthenticated.mockReturnValue(false);

    component.joinGroup(mockPublicGroups[1]);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should open Create Space modal when authenticated', () => {
    component.openCreateModal();
    expect(component.isCreateModalOpen()).toBe(true);
  });

  it('should render empty state when no groups match search', () => {
    groupServiceMock.discoverGroups.mockReturnValue(of({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
      totalPages: 0,
      last: true
    }));

    component.loadGroups();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state h3')?.textContent).toContain('No spaces found');
  });
});
