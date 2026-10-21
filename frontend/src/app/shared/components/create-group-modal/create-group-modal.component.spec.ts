import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateGroupModalComponent } from './create-group-modal.component';
import { GroupService, GroupResponse } from '../../../core/services/group.service';
import { of, throwError } from 'rxjs';

describe('CreateGroupModalComponent', () => {
  let component: CreateGroupModalComponent;
  let fixture: ComponentFixture<CreateGroupModalComponent>;
  let mockGroupService: { createGroup: ReturnType<typeof vi.fn> };

  const mockCreatedGroup: GroupResponse = {
    id: 'group-1',
    name: 'System Design Club',
    description: 'Weekly deep dives',
    topicTag: '#system-design',
    visibility: 'PUBLIC',
    avatarUrl: null,
    coverImageUrl: null,
    memberCount: 1,
    conversationId: 'conv-1',
    createdAt: '2026-10-21T10:00:00Z',
    role: 'ADMIN'
  };

  beforeEach(async () => {
    mockGroupService = {
      createGroup: vi.fn().mockReturnValue(of(mockCreatedGroup))
    };

    await TestBed.configureTestingModule({
      imports: [CreateGroupModalComponent],
      providers: [
        { provide: GroupService, useValue: mockGroupService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateGroupModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    fixture.detectChanges();
  });

  it('should create and initialize form with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.groupForm.get('visibility')?.value).toBe('PUBLIC');
  });

  it('setVisibility should update form control', () => {
    component.setVisibility('PRIVATE');
    expect(component.selectedVisibility()).toBe('PRIVATE');
  });

  it('should invalidate form when name is too short', () => {
    component.groupForm.patchValue({
      name: 'ab',
      topicTag: 'systems'
    });
    expect(component.groupForm.invalid).toBe(true);
  });

  it('onSubmit should call groupService.createGroup and emit events on success', () => {
    const groupCreatedSpy = vi.spyOn(component.groupCreated, 'emit');
    const closeModalSpy = vi.spyOn(component.closeModal, 'emit');

    component.groupForm.patchValue({
      name: 'System Design Club',
      topicTag: 'system-design',
      description: 'Weekly deep dives',
      visibility: 'PUBLIC'
    });

    component.onSubmit();

    expect(mockGroupService.createGroup).toHaveBeenCalledWith({
      name: 'System Design Club',
      topicTag: '#system-design',
      description: 'Weekly deep dives',
      visibility: 'PUBLIC'
    });
    expect(groupCreatedSpy).toHaveBeenCalledWith(mockCreatedGroup);
    expect(closeModalSpy).toHaveBeenCalled();
  });

  it('onSubmit should set errorMessage on API failure', () => {
    mockGroupService.createGroup.mockReturnValue(throwError(() => ({
      error: { message: 'Group name is already taken' }
    })));

    component.groupForm.patchValue({
      name: 'Existing Group',
      topicTag: '#existing',
      visibility: 'PUBLIC'
    });

    component.onSubmit();

    expect(component.errorMessage()).toBe('Group name is already taken');
    expect(component.isSubmitting()).toBe(false);
  });
});
