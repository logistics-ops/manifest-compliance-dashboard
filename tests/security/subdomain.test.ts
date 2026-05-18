import test from "node:test";
import assert from "node:assert/strict";
import { getSubdomainFromHostForRoot } from "../../lib/tenancy";

test("subdomain tenant lookup resolves tenant subdomains for the configured root domain", () => {
  assert.equal(getSubdomainFromHostForRoot("atlas.example.test", "example.test"), "atlas");
  assert.equal(getSubdomainFromHostForRoot("ATLAS.example.test:3000", "example.test"), "atlas");
  assert.equal(getSubdomainFromHostForRoot("atlas.example.test, proxy.example.test", "example.test"), "atlas");
});

test("subdomain tenant lookup ignores root, www, localhost, and single-label hosts", () => {
  assert.equal(getSubdomainFromHostForRoot("example.test", "example.test"), null);
  assert.equal(getSubdomainFromHostForRoot("www.example.test", "example.test"), null);
  assert.equal(getSubdomainFromHostForRoot("localhost:3000", "example.test"), null);
  assert.equal(getSubdomainFromHostForRoot("127.0.0.1:3000", "example.test"), null);
  assert.equal(getSubdomainFromHostForRoot("manifest", "example.test"), null);
});

test("subdomain tenant lookup falls back to first host label for non-root multi-label hosts", () => {
  assert.equal(getSubdomainFromHostForRoot("tenant.preview.vercel.app", "example.test"), "tenant");
  assert.equal(getSubdomainFromHostForRoot("www.preview.vercel.app", "example.test"), null);
});
