import { APITags, BadRequest, BrowserHTTPRoute, BrowserlessRoutes, ChromiumCDP, HTTPRoutes, Methods, Timeout, bestAttemptCatch, contentTypes, debugScreenshotOpts, dedent, isBase64Encoded, jsonResponse, noop, sleep, waitForEvent as waitForEvt, waitForFunction as waitForFn, } from '@browserless.io/browserless';
const scrape = async (elements, bestAttempt = false) => {
    const wait = (selector, timeout = 30000) => {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                clearTimeout(timeoutId);
                clearInterval(intervalId);
                reject(new Error(`Timed out waiting for selector "${selector}"`));
            }, timeout);
            const intervalId = setInterval(() => {
                if (document.querySelector(selector)) {
                    clearTimeout(timeoutId);
                    clearInterval(intervalId);
                    return resolve();
                }
            }, 100);
        });
    };
    if (bestAttempt) {
        const results = await Promise.allSettled(elements.map(({ selector, timeout }) => wait(selector, timeout)));
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`Selector "${elements[index].selector}" failed: ${result.reason.message}`);
            }
        });
    }
    else {
        await Promise.all(elements.map(({ selector, timeout }) => wait(selector, timeout)));
    }
    return elements.map(({ selector }) => {
        const $els = [...document.querySelectorAll(selector)];
        return {
            results: $els.map(($el) => {
                const rect = $el.getBoundingClientRect();
                return {
                    attributes: [...$el.attributes].map((attr) => ({
                        name: attr.name,
                        value: attr.value,
                    })),
                    height: $el.offsetHeight,
                    html: $el.innerHTML,
                    left: rect.left,
                    text: $el.innerText,
                    top: rect.top,
                    width: $el.offsetWidth,
                };
            }),
            selector,
        };
    });
};
export default class ChromiumScrapePostRoute extends BrowserHTTPRoute {
    name = BrowserlessRoutes.ChromiumScrapePostRoute;
    accepts = [contentTypes.json];
    auth = true;
    browser = ChromiumCDP;
    concurrency = true;
    contentTypes = [contentTypes.json];
    description = dedent(`
    A JSON-based API that returns text, html, and meta-data from a given list of selectors.
    Debugging information is available by sending in the appropriate flags in the "debugOpts"
    property. Responds with an array of JSON objects.
  `);
    method = Methods.post;
    path = [HTTPRoutes.scrape, HTTPRoutes.chromiumScrape];
    tags = [APITags.browserAPI];
    async handler(req, res, logger, browser) {
        logger.info('Scrape API invoked with body:', req.body);
        const contentType = !req.headers.accept || req.headers.accept?.includes('*')
            ? contentTypes.html
            : req.headers.accept;
        if (!req.body) {
            throw new BadRequest(`Couldn't parse JSON body`);
        }
        res.setHeader('Content-Type', contentType);
        const { bestAttempt = false, url, gotoOptions, authenticate, addScriptTag = [], addStyleTag = [], cookies = [], debugOpts, elements, emulateMediaType, html, rejectRequestPattern = [], requestInterceptors = [], rejectResourceTypes = [], setExtraHTTPHeaders, setJavaScriptEnabled, userAgent, viewport, waitForTimeout, waitForFunction, waitForSelector, waitForEvent, } = req.body;
        const content = url || html;
        if (!content) {
            throw new BadRequest(`One of "url" or "html" properties are required.`);
        }
        const page = (await browser.newPage());
        const gotoCall = url ? page.goto.bind(page) : page.setContent.bind(page);
        const messages = [];
        const outbound = [];
        const inbound = [];
        if (debugOpts?.console) {
            page.on('console', (msg) => messages.push(msg.text()));
        }
        if (debugOpts?.network) {
            page.setRequestInterception(true);
            page.on('request', (req) => {
                outbound.push({
                    headers: req.headers(),
                    method: req.method(),
                    url: req.url(),
                });
                req.continue();
            });
            page.on('response', (res) => {
                inbound.push({
                    headers: res.headers(),
                    status: res.status(),
                    url: res.url(),
                });
            });
        }
        if (emulateMediaType) {
            await page.emulateMediaType(emulateMediaType);
        }
        if (cookies.length) {
            await page.setCookie(...cookies);
        }
        if (viewport) {
            await page.setViewport(viewport);
        }
        if (userAgent) {
            await page.setUserAgent(userAgent);
        }
        if (authenticate) {
            await page.authenticate(authenticate);
        }
        if (setExtraHTTPHeaders) {
            await page.setExtraHTTPHeaders(setExtraHTTPHeaders);
        }
        if (setJavaScriptEnabled) {
            await page.setJavaScriptEnabled(setJavaScriptEnabled);
        }
        if (rejectRequestPattern.length ||
            requestInterceptors.length ||
            rejectResourceTypes.length) {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (!!rejectRequestPattern.find((pattern) => req.url().match(pattern)) ||
                    rejectResourceTypes.includes(req.resourceType())) {
                    logger.debug(`Aborting request ${req.method()}: ${req.url()}`);
                    return req.abort();
                }
                const interceptor = requestInterceptors.find((r) => req.url().match(r.pattern));
                if (interceptor) {
                    return req.respond({
                        ...interceptor.response,
                        body: interceptor.response.body
                            ? isBase64Encoded(interceptor.response.body)
                                ? Buffer.from(interceptor.response.body, 'base64')
                                : interceptor.response.body
                            : undefined,
                    });
                }
                return req.continue();
            });
        }
        var gotoResponse = await gotoCall(content, gotoOptions).catch(bestAttemptCatch(bestAttempt));

        page.on('response', (response) => {
          if (response.request().isNavigationRequest()) {
            logger.info('Navigation:', response.status(), response.url());
            gotoResponse = response;
          }
        });

      if (addStyleTag.length) {
            for (const tag in addStyleTag) {
                await page.addStyleTag(addStyleTag[tag]);
            }
        }
        if (addScriptTag.length) {
            for (const tag in addScriptTag) {
                await page.addScriptTag(addScriptTag[tag]);
            }
        }
        if (waitForTimeout) {
            await sleep(waitForTimeout).catch(bestAttemptCatch(bestAttempt));
        }
        if (waitForFunction) {
            await waitForFn(page, waitForFunction).catch(bestAttemptCatch(bestAttempt));
        }
        if (waitForSelector) {
            const { selector, hidden, timeout, visible } = waitForSelector;
            await page
                .waitForSelector(selector, { hidden, timeout, visible })
                .catch(bestAttemptCatch(bestAttempt));
        }
        if (waitForEvent) {
            await waitForEvt(page, waitForEvent).catch(bestAttemptCatch(bestAttempt));
        }
        const headers = {
            'X-Response-Code': gotoResponse?.status(),
            'X-Response-IP': gotoResponse?.remoteAddress().ip,
            'X-Response-Port': gotoResponse?.remoteAddress().port,
            'X-Response-Status': gotoResponse?.statusText(),
            'X-Response-URL': gotoResponse?.url().substring(0, 1000),
        };
        for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined) {
                res.setHeader(key, value);
            }
        }
        const data = await page.evaluate(scrape, elements, bestAttempt).catch((e) => {
            if (e.message.includes('Timed out')) {
                throw new Timeout(e);
            }
            throw e;
        });
        const [debugHTML, screenshot, pageCookies] = await Promise.all([
            debugOpts?.html ? page.content() : null,
            debugOpts?.screenshot
                ? page.screenshot(debugScreenshotOpts)
                : null,
            debugOpts?.cookies ? page.cookies() : null,
        ]);
        const debugData = debugOpts
            ? {
                console: messages,
                cookies: pageCookies,
                html: debugHTML,
                network: {
                    inbound,
                    outbound,
                },
                screenshot,
            }
            : null;
        const response = {
            data,
            debug: debugData,
        };
        page.close().catch(noop);
        logger.info('Scrape API request completed');
        return jsonResponse(res, 200, response, false);
    }
}
