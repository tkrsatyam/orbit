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
    logout: ReturnType<typeof vi.fn>;
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
      memberCount: 1,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    },
    {
      id: 'grp-2',
      name: 'LeetCode Grinders',
      description: 'Daily mock interviews and algorithm practice',
      topicTag: '#interview-prep, #dsa, #career-switch',
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
      currentUser: vi.fn().mockReturnValue({ displayName: 'Satyam Kumar', email: 'satyam@orbit.local' }),
      logout: vi.fn().mockReturnValue(of(void 0))
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

    const filters = component.topicFilters();
    expect(filters.length).toBeGreaterThan(1);
    expect(filters[0].label).toBe('All Topics');
    const labels = filters.map((f) => f.label);
    expect(labels).toContain('#java-spring');
    expect(labels).toContain('#interview-prep');
    expect(labels).toContain('#dsa');
    expect(labels).toContain('#career-switch');
  });

  it('should render navigation rail when user is authenticated with Discover active', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rail = compiled.querySelector('[data-testid="navigation-rail"]');
    expect(rail).not.toBeNull();

    const activeTab = compiled.querySelector('[data-testid="nav-tab-discover"]');
    expect(activeTab?.classList.contains('active')).toBe(true);

    const chatsBtn = compiled.querySelector('[data-testid="nav-tab-chats"]') as HTMLButtonElement;
    chatsBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/'], { queryParams: { tab: 'CHATS' } });
  });

  it('should not perform search automatically while typing, but trigger manually on search button click or Enter', () => {
    groupServiceMock.discoverGroups.mockClear();

    component.searchInputValue.set('Design');
    fixture.detectChanges();

    expect(groupServiceMock.discoverGroups).not.toHaveBeenCalled();

    const compiled = fixture.nativeElement as HTMLElement;
    const searchBtn = compiled.querySelector('[data-testid="search-trigger-btn"]') as HTMLButtonElement;
    expect(searchBtn).not.toBeNull();
    searchBtn.click();

    expect(component.activeSearchQuery()).toBe('Design');
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({
      q: 'Design',
      tag: undefined,
      page: 0,
      size: 50
    });
  });

  it('should replace search icon with clear icon when filtered, and clear query on click', () => {
    component.searchInputValue.set('Spring');
    component.executeSearch();
    fixture.detectChanges();

    expect(component.isFiltered()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    const clearBtn = compiled.querySelector('[data-testid="search-clear-btn"]') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();

    groupServiceMock.discoverGroups.mockClear();
    clearBtn.click();
    fixture.detectChanges();

    expect(component.searchInputValue()).toBe('');
    expect(component.activeSearchQuery()).toBe('');
    expect(component.isFiltered()).toBe(false);
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({
      q: '',
      tag: undefined,
      page: 0,
      size: 50
    });
  });

  it('should filter groups when selecting topic tag chip', () => {
    component.selectTag('interview-prep');

    expect(component.selectedTag()).toBe('interview-prep');
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({
      q: '',
      tag: 'interview-prep',
      page: 0,
      size: 50
    });
  });

  it('should render all topic tags on group cards and allow clicking tag to filter', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('[data-testid="group-card"]');

    // Second group card has 3 tags: #interview-prep, #dsa, #career-switch
    const card2Tags = cards[1].querySelectorAll('.tag-badge');
    expect(card2Tags.length).toBe(3);
    expect(card2Tags[0].textContent?.trim()).toBe('#interview-prep');
    expect(card2Tags[1].textContent?.trim()).toBe('#dsa');
    expect(card2Tags[2].textContent?.trim()).toBe('#career-switch');

    // Clicking tag badge filters by that tag
    groupServiceMock.discoverGroups.mockClear();
    (card2Tags[1] as HTMLButtonElement).click();
    expect(component.selectedTag()).toBe('dsa');
    expect(groupServiceMock.discoverGroups).toHaveBeenCalledWith({
      q: '',
      tag: 'dsa',
      page: 0,
      size: 50
    });
  });

  it('should format singular vs plural member count accurately', () => {
    expect(component.formatMemberCount(1)).toBe('1 member');
    expect(component.formatMemberCount(2)).toBe('2 members');
    expect(component.formatMemberCount(42)).toBe('42 members');

    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('[data-testid="group-card"]');
    expect(cards[0].querySelector('.member-count')?.textContent?.trim()).toBe('1 member');
    expect(cards[1].querySelector('.member-count')?.textContent?.trim()).toBe('15 members');
  });

  it('should render Open Group for joined groups and route to /groups/:id', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('[data-testid="group-card"]');

    const openBtn = cards[0].querySelector('[data-testid="btn-open-group"]') as HTMLButtonElement;
    expect(openBtn).not.toBeNull();
    expect(openBtn.textContent).toContain('Open Group');

    openBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/groups', 'grp-1']);
  });

  it('should render Join Group for unjoined group and call joinPublicGroup', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('[data-testid="group-card"]');

    const joinBtn = cards[1].querySelector('[data-testid="btn-join-group"]') as HTMLButtonElement;
    expect(joinBtn).not.toBeNull();
    expect(joinBtn.textContent).toContain('Join Group');

    joinBtn.click();
    expect(groupServiceMock.joinPublicGroup).toHaveBeenCalledWith('grp-2');

    const updated = component.groups().find((g) => g.id === 'grp-2');
    expect(updated?.role).toBe('MEMBER');
    expect(updated?.memberCount).toBe(16);
  });

  it('should prompt guests to login when clicking Join Group', () => {
    authServiceMock.isAuthenticated.mockReturnValue(false);

    component.joinGroup(mockPublicGroups[1]);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should open Create Group modal when authenticated', () => {
    component.openCreateModal();
    expect(component.isCreateModalOpen()).toBe(true);
  });

  it('should toggle user dropdown menu and open profile modal', () => {
    expect(component.isMenuOpen()).toBe(false);
    component.toggleMenu(new MouseEvent('click'));
    expect(component.isMenuOpen()).toBe(true);

    component.openProfileModal();
    expect(component.isMenuOpen()).toBe(false);
    expect(component.isProfileOpen()).toBe(true);
  });

  it('should handle logout from dropdown menu', () => {
    component.handleLogout();
    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should render empty state when no groups match search', () => {
    groupServiceMock.discoverGroups.mockReturnValue(
      of({
        content: [],
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
        last: true
      })
    );

    component.loadGroups();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="empty-state"] h3')?.textContent).toContain(
      'No groups found'
    );
  });
});
