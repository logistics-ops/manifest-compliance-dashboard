"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const tenancy_1 = require("../../lib/tenancy");
(0, node_test_1.default)("subdomain tenant lookup resolves tenant subdomains for the configured root domain", () => {
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("atlas.example.test", "example.test"), "atlas");
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("ATLAS.example.test:3000", "example.test"), "atlas");
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("atlas.example.test, proxy.example.test", "example.test"), "atlas");
});
(0, node_test_1.default)("subdomain tenant lookup ignores root, www, localhost, and single-label hosts", () => {
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("example.test", "example.test"), null);
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("www.example.test", "example.test"), null);
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("localhost:3000", "example.test"), null);
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("127.0.0.1:3000", "example.test"), null);
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("manifest", "example.test"), null);
});
(0, node_test_1.default)("subdomain tenant lookup falls back to first host label for non-root multi-label hosts", () => {
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("tenant.preview.vercel.app", "example.test"), "tenant");
    strict_1.default.equal((0, tenancy_1.getSubdomainFromHostForRoot)("www.preview.vercel.app", "example.test"), null);
});
