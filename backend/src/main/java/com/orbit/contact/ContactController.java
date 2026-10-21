package com.orbit.contact;

import com.orbit.common.dto.ErrorResponse;
import com.orbit.contact.dto.ConnectionRequestResponse;
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

        String requesterId = principalUserId != null ? principalUserId : (authentication != null ? authentication.getName() : null);
        ConnectionRequestResponse response = contactService.sendRequest(requesterId, requestDto.getTargetUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
