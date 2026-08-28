export type VerifiedSupportTools = {
  order?: { orderId: string; status: string; estimatedDelivery: string };
  customer?: { email: string; name: string; supportTier: string };
};

const orders: Record<string, { status: string; estimatedDelivery: string }> = {
  "DH-100001": { status: "Đang giao", estimatedDelivery: "2026-08-27" },
  "DH-100002": { status: "Đã giao", estimatedDelivery: "2026-08-20" },
};

const customers: Record<string, { name: string; supportTier: string }> = {
  "lan.nguyen@example.com": { name: "Lan Nguyễn", supportTier: "Tiêu chuẩn" },
  "minh.tran@example.com": { name: "Minh Trần", supportTier: "Ưu tiên" },
};

const containsUnsafeMarkup = (message: string) => /[<>]/.test(message);

export const dispatchSupportTools = (customerMessage: string): VerifiedSupportTools | null => {
  if (typeof customerMessage !== "string" || containsUnsafeMarkup(customerMessage)) return null;
  const result: VerifiedSupportTools = {};
  const orderId = customerMessage.match(/\bDH-\d{6}\b/)?.[0];
  if (orderId && orders[orderId]) result.order = { orderId, ...orders[orderId] };
  const email = customerMessage.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/i)?.[0]?.toLowerCase();
  if (email && customers[email]) result.customer = { email, ...customers[email] };
  return Object.keys(result).length ? result : null;
};
