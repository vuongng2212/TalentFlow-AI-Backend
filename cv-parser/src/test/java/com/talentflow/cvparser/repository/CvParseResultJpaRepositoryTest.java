package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.shared.dto.ParseStatus;
import com.talentflow.cvparser.shared.dto.ScoringStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link CvParseResultJpaRepository}.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CvParseResultJpaRepositoryTest {

    @Autowired
    private CvParseResultJpaRepository repository;

    @Test
    void shouldSaveAndFindByApplicationId() {
        UUID applicationId = UUID.randomUUID();
        CvParseResultEntity entity = CvParseResultEntity.builder()
                .applicationId(applicationId)
                .candidateId(UUID.randomUUID())
                .jobId(UUID.randomUUID())
                .status(ParseStatus.SUCCESS)
                .aiScore(85)
                .scoringStatus(ScoringStatus.SUCCESS)
                .parsedData("{\"fullName\":\"Test User\",\"email\":\"test@example.com\"}")
                .build();

        repository.save(entity);

        Optional<CvParseResultEntity> found = repository.findByApplicationId(applicationId);
        assertTrue(found.isPresent());
        assertEquals(85, found.get().getAiScore());
        assertEquals(ParseStatus.SUCCESS, found.get().getStatus());
        assertNotNull(found.get().getCreatedAt());
    }

    @Test
    void shouldCheckExistsByApplicationIdAndStatus() {
        UUID applicationId = UUID.randomUUID();
        CvParseResultEntity entity = CvParseResultEntity.builder()
                .applicationId(applicationId)
                .candidateId(UUID.randomUUID())
                .jobId(UUID.randomUUID())
                .status(ParseStatus.SUCCESS)
                .build();

        repository.save(entity);

        assertTrue(repository.existsByApplicationIdAndStatus(applicationId, ParseStatus.SUCCESS));
        assertFalse(repository.existsByApplicationIdAndStatus(applicationId, ParseStatus.FAILED));
    }

    @Test
    void shouldReturnEmptyForNonExistentApplicationId() {
        Optional<CvParseResultEntity> found = repository.findByApplicationId(UUID.randomUUID());
        assertFalse(found.isPresent());
    }

    @Test
    void shouldSaveFailedParseResultWithNullParsedDataAndErrorDetails() {
        UUID applicationId = UUID.randomUUID();
        CvParseResultEntity entity = CvParseResultEntity.builder()
                .applicationId(applicationId)
                .candidateId(UUID.randomUUID())
                .jobId(UUID.randomUUID())
                .status(ParseStatus.FAILED)
                .errorCode("CORRUPT_DOCUMENT")
                .errorMessage("Document stream was truncated or corrupted")
                .parsedData(null)
                .build();

        repository.save(entity);

        Optional<CvParseResultEntity> found = repository.findByApplicationId(applicationId);
        assertTrue(found.isPresent());
        assertEquals(ParseStatus.FAILED, found.get().getStatus());
        assertEquals("CORRUPT_DOCUMENT", found.get().getErrorCode());
        assertEquals("Document stream was truncated or corrupted", found.get().getErrorMessage());
        assertNull(found.get().getParsedData());
    }

    @Test
    void shouldSaveParseResultWithCorruptParsedDataString() {
        UUID applicationId = UUID.randomUUID();
        CvParseResultEntity entity = CvParseResultEntity.builder()
                .applicationId(applicationId)
                .candidateId(UUID.randomUUID())
                .jobId(UUID.randomUUID())
                .status(ParseStatus.FAILED)
                .errorCode("PARSING_FAILED")
                .errorMessage("Invalid JSON structure extracted")
                .parsedData("{corrupt_raw_json: incomplete")
                .build();

        repository.save(entity);

        Optional<CvParseResultEntity> found = repository.findByApplicationId(applicationId);
        assertTrue(found.isPresent());
        assertEquals("{corrupt_raw_json: incomplete", found.get().getParsedData());
    }
}
