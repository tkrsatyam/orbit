package com.orbit.contact;

import com.orbit.common.dto.ErrorResponse;
import com.orbit.contact.dto.AcceptRequestResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
import com.orbit.contact.dto.ContactListResponse;
import com.orbit.contact.dto.IncomingRequestsResponse;
import com.orbit.contact.dto.RequestAction;
import com.orbit.contact.dto.RespondRequestDto;
import com.orbit.contact.dto.SendRequestDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller for contact relationships and connection requests.
 * See docs/API_CONTRACTS.md (Contact Endpoints).
 */
@Tag(name = "Contacts", description = "Contact requests, connection management, and relationships")
@RestController
@RequestMapping("/api/v1/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @Operation(summary = "Send a connection request", description = "Sends an outbound connection request to another user")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "201",
                    description = "Connection request created successfully",
                    content = @Content(schema = @Schema(implementation = ConnectionRequestResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid request payload or attempting to connect to self",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Target user account not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Request already exists, users are already connected, or blocked relationship",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/requests")
    public ResponseEntity<ConnectionRequestResponse> sendRequest(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @Valid @RequestBody SendRequestDto requestDto) {

        String requesterId = resolveUserId(principalUserId, authentication);
        ConnectionRequestResponse response = contactService.sendRequest(requesterId, requestDto.getTargetUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get pending incoming connection requests", description = "Retrieves all pending incoming connection requests for the authenticated user")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Pending requests retrieved successfully",
                    content = @Content(schema = @Schema(implementation = IncomingRequestsResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping("/requests")
    public ResponseEntity<IncomingRequestsResponse> getIncomingRequests(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {

        String receiverId = resolveUserId(principalUserId, authentication);
        IncomingRequestsResponse response = contactService.getIncomingRequests(receiverId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Accept or decline a connection request", description = "Responds to an incoming connection request by accepting or declining it")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Connection request accepted successfully and DM conversation created",
                    content = @Content(schema = @Schema(implementation = AcceptRequestResponse.class))
            ),
            @ApiResponse(
                    responseCode = "204",
                    description = "Connection request declined and deleted quietly"
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid action or request payload",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Connection request not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Connection request is not in PENDING state",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PatchMapping("/requests/{requestId}")
    public ResponseEntity<?> respondToRequest(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String requestId,
            @Valid @RequestBody RespondRequestDto respondDto) {

        String receiverId = resolveUserId(principalUserId, authentication);
        AcceptRequestResponse response = contactService.respondToRequest(receiverId, requestId, respondDto.getAction());

        if (respondDto.getAction() == RequestAction.DECLINE) {
            return ResponseEntity.noContent().build();
        }

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get authenticated user's contact list", description = "Retrieves all established contacts with live presence status for the authenticated user")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Contacts retrieved successfully",
                    content = @Content(schema = @Schema(implementation = ContactListResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @GetMapping
    public ResponseEntity<ContactListResponse> getContacts(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication) {

        String userId = resolveUserId(principalUserId, authentication);
        ContactListResponse response = contactService.getContactList(userId);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Remove a contact (unfriend)", description = "Permanently removes an established contact relationship quietly without lingering status records")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "204",
                    description = "Contact removed successfully"
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or blacklisted access token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Contact relationship not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @DeleteMapping("/{contactId}")
    public ResponseEntity<Void> removeContact(
            @AuthenticationPrincipal String principalUserId,
            Authentication authentication,
            @PathVariable String contactId) {

        String userId = resolveUserId(principalUserId, authentication);
        contactService.removeContact(userId, contactId);
        return ResponseEntity.noContent().build();
    }

    private String resolveUserId(String principalUserId, Authentication authentication) {
        return principalUserId != null ? principalUserId : (authentication != null ? authentication.getName() : null);
    }
}
