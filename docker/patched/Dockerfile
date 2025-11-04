ARG VERSION=latest
FROM ghcr.io/browserless/chrome:$VERSION

COPY ft/scrape.http.js /usr/src/app/build/shared/scrape.http.js

USER blessuser

CMD ["./scripts/start.sh"]
