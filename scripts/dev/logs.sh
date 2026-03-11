#!/usr/bin/env sh
docker compose -f infra/compose/docker-compose.yml logs -f "${1:-}"
