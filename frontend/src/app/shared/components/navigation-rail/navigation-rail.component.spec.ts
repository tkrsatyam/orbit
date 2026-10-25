import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '../../../core/models/auth.model';
import { NavigationRailComponent } from './navigation-rail.component';

describe('NavigationRailComponent', () => {
  let component: NavigationRailComponent;
  let fixture: ComponentFixture<NavigationRailComponent>;

  const mockUser: User = {
    id: 'user-1',
    email: 'satyam.kumar@example.com',
    displayName: 'Satyam Kumar'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationRailComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationRailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create navigation-rail component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit tabChange when a tab button is clicked', () => {
    let selectedTab = '';
    component.tabChange.subscribe(tab => {
      selectedTab = tab;
    });

    const groupsBtn = fixture.nativeElement.querySelector('[data-testid="nav-tab-groups"]');
    groupsBtn.click();

    expect(selectedTab).toBe('GROUPS');
  });

  it('should show incoming request dot when incomingCount > 0 and tab is not chats', () => {
    fixture.componentRef.setInput('incomingCount', 2);
    fixture.detectChanges();

    const dot = fixture.nativeElement.querySelector('[data-testid="chats-badge-dot"]');
    expect(dot).toBeTruthy();
  });

  it('should toggle user dropdown menu when avatar button is clicked', () => {
    fixture.componentRef.setInput('user', mockUser);
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(false);

    const avatarBtn = fixture.nativeElement.querySelector('[data-testid="user-avatar-badge"]');
    avatarBtn.click();
    fixture.detectChanges();

    expect(component.isMenuOpen()).toBe(true);
    const menu = fixture.nativeElement.querySelector('[data-testid="user-dropdown-menu"]');
    expect(menu).toBeTruthy();
  });

  it('should emit openProfile when My profile is clicked in menu', () => {
    let profileOpened = false;
    component.openProfile.subscribe(() => {
      profileOpened = true;
    });

    fixture.componentRef.setInput('user', mockUser);
    component.isMenuOpen.set(true);
    fixture.detectChanges();

    const profileBtn = fixture.nativeElement.querySelector('[data-testid="menu-my-profile-btn"]');
    profileBtn.click();

    expect(profileOpened).toBe(true);
    expect(component.isMenuOpen()).toBe(false);
  });

  it('should emit signOut when Sign out is clicked in menu', () => {
    let signedOut = false;
    component.signOut.subscribe(() => {
      signedOut = true;
    });

    fixture.componentRef.setInput('user', mockUser);
    component.isMenuOpen.set(true);
    fixture.detectChanges();

    const signOutBtn = fixture.nativeElement.querySelector('[data-testid="signout-button"]');
    signOutBtn.click();

    expect(signedOut).toBe(true);
    expect(component.isMenuOpen()).toBe(false);
  });

  it('should toggle theme when theme toggle button is clicked', () => {
    const themeBtn = fixture.nativeElement.querySelector('[data-testid="theme-toggle-btn"]');
    expect(themeBtn).toBeTruthy();

    const initialTheme = component.isDark();
    themeBtn.click();
    fixture.detectChanges();

    expect(component.isDark()).toBe(!initialTheme);
  });

  it('should display light logo in light mode and dark logo in dark mode', () => {
    const img = fixture.nativeElement.querySelector('.rail-brand-icon') as HTMLImageElement;
    if (component.isDark()) {
      expect(img.src).toContain('brand/orbit-icon.svg');
    } else {
      expect(img.src).toContain('brand/orbit-icon-light.svg');
    }
  });
});
