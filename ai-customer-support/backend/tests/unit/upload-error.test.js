const test = require("node:test");
const assert = require("node:assert/strict");
const multer = require("multer");
const { errorHandler } = require("../../dist/middleware/error.middleware.js");

const response = () => {
  const state = { statusCode: 0, payload: null };
  return { state, status(code) { state.statusCode = code; return this; }, json(payload) { state.payload = payload; return this; } };
};

test("upload size errors return a safe client error", () => {
  const res = response();
  const originalError = console.error;
  console.error = () => {};
  errorHandler(new multer.MulterError("LIMIT_FILE_SIZE"), {}, res, () => {});
  console.error = originalError;
  assert.equal(res.state.statusCode, 400);
  assert.match(res.state.payload.message, /5 MB/i);
});
