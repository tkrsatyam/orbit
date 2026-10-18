package com.orbit.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/** Enables @CreatedDate / @LastModifiedDate across all documents. */
@Configuration
@EnableMongoAuditing
public class MongoConfig {
}
