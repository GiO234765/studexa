FROM node:24-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ARG VITE_BETA_SUPPORT_EMAIL
ENV VITE_BETA_ENABLED=true
RUN npm run build

FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app/backend
COPY backend/ ./
COPY --from=frontend /app/frontend/dist/ ./src/main/resources/static/
RUN sh ./mvnw -B -ntp -Dmaven.test.skip=true package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system studexa && useradd --system --gid studexa studexa
COPY --from=backend --chown=studexa:studexa /app/backend/target/studexa-*.jar ./studexa.jar
USER studexa
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=55 -XX:ActiveProcessorCount=2"
EXPOSE 10000
ENTRYPOINT ["java", "-jar", "studexa.jar"]
