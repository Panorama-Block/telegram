# Telegram Gateway Azure VM Deployment Bundle

This directory contains the runtime bundle for the Telegram gateway VM introduced in step 1 of the two-VM transition.

- `docker-compose.yml`: runs only the Telegram gateway container on the VM
- `Caddyfile`: terminates HTTPS and reverse proxies to the local gateway port
- `.env.production.example`: runtime variable template
- `scripts/deploy.sh`: pulls the image, renders Caddy, and restarts the stack

## Notes

- This VM is for Telegram bot/webhook/auth-proxy traffic only.
- `PUBLIC_WEBAPP_URL` must continue to point at the current MiniApp host in step 1.
- `NEXTJS_PROXY_ENABLED=false` is the intended production mode for this VM path.
- Redis is intentionally omitted from this bundle.
