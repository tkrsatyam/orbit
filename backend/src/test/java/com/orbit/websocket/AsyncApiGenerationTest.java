package com.orbit.websocket;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.data.mongodb.auto-index-creation=false",
        "management.health.mongo.enabled=false"
})
class AsyncApiGenerationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void generatesAsyncApiYamlContract() throws Exception {
        MvcResult result = mockMvc.perform(get("/springwolf/docs").accept("application/yaml"))
                .andExpect(status().isOk())
                .andReturn();

        String yaml = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(yaml).isNotEmpty();
        assertThat(yaml).contains("asyncapi:");
        assertThat(yaml).contains("Orbit Real-Time API");

        // Verify key real-time channels
        assertThat(yaml).contains("/app/conversations/{id}/send");
        assertThat(yaml).contains("/app/conversations/{id}/read");
        assertThat(yaml).contains("/app/conversations/{id}/typing");
        assertThat(yaml).contains("/topic/conversations/{conversationId}/messages");
        assertThat(yaml).contains("/topic/presence/{userId}");
        assertThat(yaml).contains("/user/queue/notifications");
        assertThat(yaml).contains("chat.messages");
        assertThat(yaml).contains("chat.presence");
        assertThat(yaml).contains("chat.notifications");

        Path root = Paths.get("").toAbsolutePath();
        Path targetPath;
        if (Files.exists(root.resolve("pom.xml")) && root.endsWith("backend")) {
            targetPath = root.resolve("asyncapi.yaml");
        } else if (Files.exists(root.resolve("backend"))) {
            targetPath = root.resolve("backend/asyncapi.yaml");
        } else {
            targetPath = root.resolve("asyncapi.yaml");
        }

        Files.writeString(targetPath, yaml, StandardCharsets.UTF_8);
        assertThat(Files.exists(targetPath)).isTrue();
    }

    @Test
    void servesAsyncApiUiHtml() throws Exception {
        mockMvc.perform(get("/springwolf/asyncapi-ui.html"))
                .andExpect(status().isOk());
    }
}
