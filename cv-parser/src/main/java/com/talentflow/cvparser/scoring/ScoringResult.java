package com.talentflow.cvparser.scoring;

import com.talentflow.cvparser.shared.dto.ScoringStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Immutable result of a Gemini scoring call.
 * Used within {@link CandidateScoringService}; not persisted directly.
 */
@Data
@Builder
@AllArgsConstructor
public class ScoringResult {

    private final int aiScore;              // 0-100
    private final String scoringReasoning;  // nullable
    private final ScoringStatus scoringStatus;
}
