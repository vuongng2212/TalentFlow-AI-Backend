# CV Parser Service - Multi-stage Docker Build
# Includes Tesseract OCR for scanned document processing

# ==============================================================================
# Stage 1: Build
# ==============================================================================
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy pom.xml first for dependency caching
COPY pom.xml .

# Download dependencies (cached if pom.xml unchanged)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application (skip tests - they run in CI)
RUN mvn clean package -DskipTests -B

# ==============================================================================
# Stage 2: Runtime
# ==============================================================================
FROM eclipse-temurin:17-jre-jammy

# Install Tesseract OCR and language packs
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-vie \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r cvparser && useradd -r -g cvparser cvparser

# Set working directory
WORKDIR /app

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Change ownership to non-root user
RUN chown -R cvparser:cvparser /app

# Switch to non-root user
USER cvparser

# Expose application port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8081/actuator/health || exit 1

# JVM configuration for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"

# Set Tesseract data path
ENV TESSERACT_DATA_PATH=/usr/share/tesseract-ocr/5/tessdata

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
