# Telegram Gateway Azure VM Deployment Bundle

This directory contains the runtime bundle reference for the Telegram gateway image introduced in step 1 of the two-VM transition.

- `docker-compose.yml`: reference compose service for the gateway container
- `Caddyfile`: reference Caddy config for a dedicated gateway-only host
- `.env.production.example`: runtime variable template
- `scripts/deploy.sh`: reference deploy script kept for local/manual use

## Notes

- In step 2, GitHub Actions in this repo only builds and publishes the `telegram-gateway` image.
- The backend repo owns deployment of the shared public/api VM bundle and consumes the published gateway image.
- `PUBLIC_WEBAPP_URL` must continue to point at the current MiniApp host in step 1.
- `NEXTJS_PROXY_ENABLED=false` is the intended production mode for this VM path.
- Redis is intentionally omitted from this bundle.
