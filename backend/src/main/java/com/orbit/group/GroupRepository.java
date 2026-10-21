package com.orbit.group;

import com.orbit.group.model.Group;
import com.orbit.group.model.GroupVisibility;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends MongoRepository<Group, String> {

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, String id);

    Optional<Group> findByInviteToken(String inviteToken);

    List<Group> findByMembersUserId(String userId);

    List<Group> findByVisibility(GroupVisibility visibility);
}
