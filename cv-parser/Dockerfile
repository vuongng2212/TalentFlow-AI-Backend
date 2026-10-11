# CV Parser Service - Optimized Alpine Build
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S cvparser && adduser -S cvparser -G cvparser
WORKDIR /app

# Copy prebuilt fat JAR
COPY target/*.jar app.jar
RUN chown -R cvparser:cvparser /app

USER cvparser

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:8081/actuator/health || exit 1

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
