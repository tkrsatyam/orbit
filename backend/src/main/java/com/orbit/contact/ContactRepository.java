package com.orbit.contact;

import com.orbit.contact.model.Contact;
import com.orbit.contact.model.ContactStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContactRepository extends MongoRepository<Contact, String> {

    @Query("{ $or: [ { 'requesterId': ?0, 'receiverId': ?1 }, { 'requesterId': ?1, 'receiverId': ?0 } ] }")
    Optional<Contact> findBetweenUsers(String userId1, String userId2);

    Optional<Contact> findByRequesterIdAndReceiverId(String requesterId, String receiverId);

    List<Contact> findByReceiverIdAndStatus(String receiverId, ContactStatus status);

    @Query("{ $or: [ { 'requesterId': ?0 }, { 'receiverId': ?0 } ] }")
    List<Contact> findAllByUserId(String userId);
}
