const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeLoginInput, normalizeRegistrationInput } = require("../../dist/services/auth-input.service.js");

test("registration input trims identity fields and normalizes email casing", () => {
  assert.deepEqual(
    normalizeRegistrationInput({ name: "  Nguyễn An  ", email: "  AN@Example.COM ", password: "secret1" }),
    { name: "Nguyễn An", email: "an@example.com", password: "secret1" },
  );
});

test("auth input rejects missing, malformed, and overlong values before database access", () => {
  assert.throws(() => normalizeRegistrationInput({ name: " ", email: "an@example.com", password: "secret1" }), /name/i);
  assert.throws(() => normalizeRegistrationInput({ name: "Nguyễn An", email: "not-an-email", password: "secret1" }), /email/i);
  assert.throws(() => normalizeRegistrationInput({ name: "Nguyễn An", email: "an@example.com", password: "short" }), /password/i);
  assert.throws(() => normalizeLoginInput({ email: "an@example.com", password: 123 }), /password/i);
});

test("login input uses the same canonical email as registration", () => {
  assert.deepEqual(
    normalizeLoginInput({ email: "  AN@Example.COM ", password: "secret1" }),
    { email: "an@example.com", password: "secret1" },
  );
});
