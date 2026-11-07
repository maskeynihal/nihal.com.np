#!/bin/sh
cd "$(dirname "$0")"
cat parts/p0.html parts/p1.js $(ls parts/v?.js) parts/p9.js > index.html
wc -c index.html
