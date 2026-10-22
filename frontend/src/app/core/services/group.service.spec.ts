import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { GroupService, CreateGroupPayload, GroupResponse, InviteResponse, GroupJoinResponse, GroupPageResponse } from './group.service';

describe('GroupService', () => {
  let service: GroupService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GroupService
      ]
    });

    service = TestBed.inject(GroupService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loadMyGroups should fetch user groups and update signal', () => {
    const mockGroups: GroupResponse[] = [
      {
        id: 'group-1',
        name: 'Java Builders',
        description: 'Java group',
        topicTag: 'java-spring',
        visibility: 'PUBLIC',
        avatarUrl: null,
        coverImageUrl: null,
        memberCount: 5,
        conversationId: 'conv-1',
        createdAt: '2026-10-21T10:00:00Z',
        role: 'ADMIN'
      }
    ];

    service.loadMyGroups().subscribe((groups) => {
      expect(groups).toEqual(mockGroups);
      expect(service.myGroups()).toEqual(mockGroups);
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(mockGroups);
  });

  it('createGroup should dispatch POST and prepend to myGroups', () => {
    const payload: CreateGroupPayload = {
      name: 'System Design Club',
      description: 'Distributed systems',
      topicTag: 'system-design',
      visibility: 'PUBLIC'
    };

    const mockResponse: GroupResponse = {
      id: 'group-2',
      name: 'System Design Club',
      description: 'Distributed systems',
      topicTag: 'system-design',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 1,
      conversationId: 'conv-2',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    };

    service.createGroup(payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.myGroups()[0]).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('generateInvite should dispatch POST to /api/v1/groups/{groupId}/invite', () => {
    const mockInvite: InviteResponse = {
      inviteLink: 'http://localhost:4200/invite/token-abc',
      expiresAt: '2026-10-28T10:00:00Z'
    };

    service.generateInvite('group-1').subscribe((res) => {
      expect(res).toEqual(mockInvite);
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1/invite`);
    expect(req.request.method).toBe('POST');
    req.flush(mockInvite);
  });

  it('joinViaInvite should dispatch POST to /api/v1/groups/join-via-invite/{token}', () => {
    const mockJoin: GroupJoinResponse = {
      groupId: 'group-1',
      conversationId: 'conv-1',
      role: 'MEMBER'
    };

    service.joinViaInvite('token-abc').subscribe((res) => {
      expect(res).toEqual(mockJoin);
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/join-via-invite/token-abc`);
    expect(req.request.method).toBe('POST');
    req.flush(mockJoin);
  });

  it('getGroupDetails should fetch group details', () => {
    const mockDetails: GroupResponse = {
      id: 'group-1',
      name: 'System Design Club',
      description: 'Distributed systems',
      topicTag: '#systems',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 8,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    };

    service.getGroupDetails('group-1').subscribe((res) => {
      expect(res).toEqual(mockDetails);
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetails);
  });

  it('updateGroup should dispatch PATCH and update matching group in myGroups signal', () => {
    const originalGroup: GroupResponse = {
      id: 'group-1',
      name: 'Original Name',
      description: 'Original Desc',
      topicTag: '#original',
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 5,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    };
    service.myGroups.set([originalGroup]);

    const updatedGroup: GroupResponse = {
      ...originalGroup,
      name: 'Updated Name',
      topicTag: '#updated'
    };

    service.updateGroup('group-1', { name: 'Updated Name', topicTag: '#updated' }).subscribe((res) => {
      expect(res).toEqual(updatedGroup);
      expect(service.myGroups()[0].name).toBe('Updated Name');
      expect(service.myGroups()[0].topicTag).toBe('#updated');
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Updated Name', topicTag: '#updated' });
    req.flush(updatedGroup);
  });

  it('getGroupMembers should fetch group members roster', () => {
    const mockMemberList = {
      content: [
        {
          userId: 'user-1',
          displayName: 'Admin User',
          avatarUrl: null,
          role: 'ADMIN' as const,
          online: true,
          joinedAt: '2026-10-21T10:00:00Z'
        },
        {
          userId: 'user-2',
          displayName: 'Member User',
          avatarUrl: null,
          role: 'MEMBER' as const,
          online: false,
          joinedAt: '2026-10-21T11:00:00Z'
        }
      ]
    };

    service.getGroupMembers('group-1').subscribe((res) => {
      expect(res.content.length).toBe(2);
      expect(res.content[0].displayName).toBe('Admin User');
      expect(res.content[1].role).toBe('MEMBER');
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1/members`);
    expect(req.request.method).toBe('GET');
    req.flush(mockMemberList);
  });

  it('updateMemberRole should send PATCH to update member role', () => {
    const mockUpdatedMember = {
      userId: 'user-2',
      displayName: 'Member User',
      avatarUrl: null,
      role: 'ADMIN' as const,
      online: false,
      joinedAt: '2026-10-21T11:00:00Z'
    };

    service.updateMemberRole('group-1', 'user-2', { role: 'ADMIN' }).subscribe((res) => {
      expect(res.role).toBe('ADMIN');
      expect(res.userId).toBe('user-2');
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1/members/user-2/role`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush(mockUpdatedMember);
  });

  it('leaveGroup should send POST to /leave and remove group from myGroups', () => {
    const existingGroup: GroupResponse = {
      id: 'group-1',
      name: 'Leaving Space',
      description: null,
      topicTag: null,
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 2,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'MEMBER'
    };
    service.myGroups.set([existingGroup]);

    service.leaveGroup('group-1').subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1/leave`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);

    expect(service.myGroups()).toEqual([]);
  });

  it('removeMember should send DELETE to /members/{userId}', () => {
    service.removeMember('group-1', 'user-2').subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1/members/user-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('deleteGroup should send DELETE to /groups/{groupId} and remove from myGroups', () => {
    const existingGroup: GroupResponse = {
      id: 'group-1',
      name: 'Doomed Space',
      description: null,
      topicTag: null,
      visibility: 'PUBLIC',
      avatarUrl: null,
      coverImageUrl: null,
      memberCount: 1,
      conversationId: 'conv-1',
      createdAt: '2026-10-21T10:00:00Z',
      role: 'ADMIN'
    };
    service.myGroups.set([existingGroup]);

    service.deleteGroup('group-1').subscribe();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/group-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(service.myGroups()).toEqual([]);
  });

  it('discoverGroups should send GET with query params', () => {
    const mockPage: GroupPageResponse = {
      content: [
        {
          id: 'grp-1',
          name: 'Distributed Systems',
          description: 'Desc',
          topicTag: 'system-design',
          visibility: 'PUBLIC',
          avatarUrl: null,
          coverImageUrl: null,
          memberCount: 10,
          conversationId: 'conv-1',
          createdAt: '2026-10-21T10:00:00Z',
          role: 'MEMBER'
        }
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      last: true
    };

    service.discoverGroups({ q: 'Systems', tag: 'system-design', page: 0, size: 20 }).subscribe((res) => {
      expect(res.content.length).toBe(1);
      expect(res.content[0].name).toBe('Distributed Systems');
    });

    const req = httpTesting.expectOne((r) =>
      r.url === `${environment.apiBaseUrl}/api/v1/groups` &&
      r.params.get('q') === 'Systems' &&
      r.params.get('tag') === 'system-design' &&
      r.params.get('page') === '0' &&
      r.params.get('size') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('joinPublicGroup should send POST to /{groupId}/join', () => {
    const mockJoinRes: GroupJoinResponse = {
      groupId: 'grp-1',
      conversationId: 'conv-1',
      role: 'MEMBER'
    };

    service.joinPublicGroup('grp-1').subscribe((res) => {
      expect(res.groupId).toBe('grp-1');
      expect(res.role).toBe('MEMBER');
    });

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/api/v1/groups/grp-1/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(mockJoinRes);
  });
});
