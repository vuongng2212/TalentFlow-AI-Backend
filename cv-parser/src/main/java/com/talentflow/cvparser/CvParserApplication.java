package com.talent.cvparser;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@EnableAsync
@ConfigurationPropertiesScan
public class CvParserApplication {

    public static void main(String[] args) {
        SpringApplication.run(CvParserApplication.class, args);
    }

}
