# Build stage
FROM maven:3.9.8-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
COPY spring-boot/pom.xml spring-boot/
COPY spring-boot/src spring-boot/src

RUN mvn -f spring-boot/pom.xml -q clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S annsetu && adduser -u 1001 -S annsetu -G annsetu

COPY --from=builder /app/spring-boot/target/*.jar app.jar

RUN chown -R annsetu:annsetu /app

USER annsetu

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]