ARG VERSION=latest
FROM ghcr.io/browserless/chrome:$VERSION

COPY src src/

USER blessuser

CMD ["./scripts/start.sh"]
