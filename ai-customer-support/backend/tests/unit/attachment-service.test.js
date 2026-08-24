const test = require("node:test");
const assert = require("node:assert/strict");

const { allowedAttachmentMimeTypes, validateAttachment } = require("../../dist/services/attachment.service.js");

test("attachment validation accepts supported documents and images within the size limit", () => {
  assert.equal(validateAttachment({ mimetype: "image/png", size: 1024 }), true);
  assert.equal(validateAttachment({ mimetype: "application/pdf", size: 5 * 1024 * 1024 }), true);
  assert.ok(allowedAttachmentMimeTypes.includes("text/plain"));
});

test("attachment validation rejects unsupported content types and oversized uploads", () => {
  assert.throws(() => validateAttachment({ mimetype: "application/x-msdownload", size: 1024 }), /type/i);
  assert.throws(() => validateAttachment({ mimetype: "image/jpeg", size: 5 * 1024 * 1024 + 1 }), /size/i);
});
