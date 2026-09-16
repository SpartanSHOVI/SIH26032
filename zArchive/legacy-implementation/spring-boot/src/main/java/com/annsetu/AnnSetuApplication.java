package com.annsetu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.annsetu.repository")
@EntityScan(basePackages = "com.annsetu.entity")
@EnableAsync
@EnableScheduling
public class AnnSetuApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnnSetuApplication.class, args);
    }
}