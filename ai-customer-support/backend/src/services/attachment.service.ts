export const maxAttachmentBytes = 5 * 1024 * 1024;
export const allowedAttachmentMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"] as const;

export const validateAttachment = ({ mimetype, size }: { mimetype: string; size: number }): true => {
  if (!allowedAttachmentMimeTypes.includes(mimetype as (typeof allowedAttachmentMimeTypes)[number])) throw new Error("Unsupported attachment type");
  if (!Number.isInteger(size) || size < 1 || size > maxAttachmentBytes) throw new Error("Attachment exceeds the 5 MB size limit");
  return true;
};
