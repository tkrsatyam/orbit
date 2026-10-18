package com.orbit.common.config;

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
class OpenApiGenerationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void generatesOpenApiYamlContract() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs.yaml"))
                .andExpect(status().isOk())
                .andReturn();

        String yaml = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(yaml).isNotEmpty();
        assertThat(yaml).contains("openapi:");
        assertThat(yaml).contains("Orbit API");

        Path root = Paths.get("").toAbsolutePath();
        Path targetPath;
        if (Files.exists(root.resolve("pom.xml")) && root.endsWith("backend")) {
            targetPath = root.resolve("openapi.yaml");
        } else if (Files.exists(root.resolve("backend"))) {
            targetPath = root.resolve("backend/openapi.yaml");
        } else {
            targetPath = root.resolve("openapi.yaml");
        }

        Files.writeString(targetPath, yaml, StandardCharsets.UTF_8);
        assertThat(Files.exists(targetPath)).isTrue();
    }
}
