import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { GroupService, CreateGroupPayload, GroupResponse, InviteResponse, GroupJoinResponse } from './group.service';

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
});
