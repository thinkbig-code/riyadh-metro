import test from "node:test";
import assert from "node:assert/strict";
import { createMetroEngine } from "../src/core/metro.js";
import { parseRouteLink } from "../src/core/links.ts";
const e = createMetroEngine();
test("public and installed-app links restore validated trip", () => {
  assert.deepEqual(parseRouteLink("https://riyadhmetro.fyi/#t12~kafd~ar", e), {
    from: "t12",
    to: "kafd",
    language: "ar",
  });
  assert.equal(
    parseRouteLink("riyadhmetro://trip#t12~museum~en", e).to,
    "museum",
  );
});
test("untrusted hosts, protocols and unknown tokens rejected", () => {
  for (const url of [
    "https://evil.test/#t12~kafd",
    "https://riyadhmetro.fyi.evil.test/#t12~kafd",
    "http://riyadhmetro.fyi/#t12~kafd",
    "https://riyadhmetro.fyi/#bad~kafd",
    "not a url",
  ])
    assert.equal(parseRouteLink(url, e), null);
  assert.equal(
    parseRouteLink("https://riyadhmetro.fyi/#t12~kafd~unknown", e).language,
    undefined,
  );
});
