import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InviteJoinComponent } from './invite-join.component';
import { GroupService, GroupJoinResponse } from '../../core/services/group.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('InviteJoinComponent', () => {
  let component: InviteJoinComponent;
  let fixture: ComponentFixture<InviteJoinComponent>;
  let mockGroupService: { joinViaInvite: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockActivatedRoute: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };

  const mockJoinResponse: GroupJoinResponse = {
    groupId: 'group-1',
    conversationId: 'conv-1',
    role: 'MEMBER'
  };

  beforeEach(async () => {
    mockGroupService = {
      joinViaInvite: vi.fn().mockReturnValue(of(mockJoinResponse))
    };

    mockRouter = {
      navigate: vi.fn()
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('valid-token-123')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [InviteJoinComponent],
      providers: [
        { provide: GroupService, useValue: mockGroupService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InviteJoinComponent);
    component = fixture.componentInstance;
  });

  it('should join group successfully on init when token is valid', () => {
    fixture.detectChanges();

    expect(mockGroupService.joinViaInvite).toHaveBeenCalledWith('valid-token-123');
    expect(component.status()).toBe('SUCCESS');
    expect(component.result()).toEqual(mockJoinResponse);
  });

  it('should show error state when token is missing', () => {
    mockActivatedRoute.snapshot.paramMap.get.mockReturnValue(null);
    fixture.detectChanges();

    expect(component.status()).toBe('ERROR');
    expect(component.errorMessage()).toContain('No invite token');
  });

  it('should show error state when joinViaInvite fails', () => {
    mockGroupService.joinViaInvite.mockReturnValue(throwError(() => ({
      error: { message: 'Invite link is invalid or has expired' }
    })));

    fixture.detectChanges();

    expect(component.status()).toBe('ERROR');
    expect(component.errorMessage()).toBe('Invite link is invalid or has expired');
  });

  it('navigateToGroup should route to /groups/:groupId', () => {
    fixture.detectChanges();
    component.navigateToGroup();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/groups', 'group-1']);
  });
});
