# =====================================================================
# Delander - imagem unica para hospedagem
#
# O docker-compose de desenvolvimento sobe tres containers (db, api, web).
# Para hospedar de graca isso nao serve: cada servico gasta uma cota, e o
# front chama "/api" relativo, entao ele precisa sair da MESMA origem da API.
#
# Aqui o front e compilado e entra como recurso estatico dentro do jar. Um
# processo, uma porta, uma origem: sem CORS, sem URL de API configurada,
# sem nginx. O banco fica fora (Postgres gerenciado, por SPRING_DATASOURCE_*).
# =====================================================================

# ---------- 1. a tela ----------
FROM node:22-alpine AS tela
WORKDIR /tela
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- 2. o jar, com a tela dentro ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY backend/pom.xml .
RUN mvn -B dependency:go-offline
COPY backend/src ./src
# static/ e onde o Spring procura recurso estatico no classpath
COPY --from=tela /tela/dist ./src/main/resources/static
RUN mvn -B clean package -DskipTests

# ---------- 3. runtime ----------
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app && mkdir -p /dados/uploads && chown -R app:app /dados
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER app

# A hospedagem escolhe a porta e manda em $PORT; 8080 e o padrao local.
ENV PORT=8080
# 512 MB de RAM e o teto do plano gratuito. MaxRAMPercentage deixa a JVM
# calcular o heap a partir do que o container realmente recebeu, em vez de
# um -Xmx fixo que estoura quando o plano muda.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -Dserver.port=$PORT -jar app.jar"]
