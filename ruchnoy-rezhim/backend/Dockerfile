FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend ./backend
COPY shared ./shared

RUN dotnet restore backend/runners/dotnet-runner/CodeRehab.DotNetRunner.sln \
    && dotnet build backend/runners/dotnet-runner/CodeRehab.DotNetRunner.sln --no-restore

ENV CODE_REHAB_BACKEND_HOST=0.0.0.0
ENV CODE_REHAB_BACKEND_PORT=5088

EXPOSE 5088

CMD ["node", "backend/api/server.mjs"]
