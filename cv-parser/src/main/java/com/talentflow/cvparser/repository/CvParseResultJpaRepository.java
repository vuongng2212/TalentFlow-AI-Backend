package com.talentflow.cvparser.repository;

import com.talentflow.cvparser.shared.dto.ParseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Spring Data JPA repository for {@link CvParseResultEntity}.
 * Provides CRUD operations and query methods for the cv_parse_results table.
 */
@Repository
public interface CvParseResultJpaRepository extends JpaRepository<CvParseResultEntity, UUID> {

    /**
     * Find a parse result by application ID.
     */
    Optional<CvParseResultEntity> findByApplicationId(UUID applicationId);

    /**
     * Check if a parse result exists for the given application ID with a specific status.
     */
    boolean existsByApplicationIdAndStatus(UUID applicationId, ParseStatus status);
}
