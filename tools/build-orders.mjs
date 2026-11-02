// Expands the compact order specs below into data/orders.json.
// Prices come from catalog.json and totals are computed, so the numbers can't drift.
// Run: node tools/build-orders.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "data/catalog.json"), "utf8"));
const customers = JSON.parse(readFileSync(join(root, "data/customers.json"), "utf8")).customers;
const price = Object.fromEntries(catalog.products.map((p) => [p.sku, p.price]));
const cust = Object.fromEntries(customers.map((c) => [c.customerId, c]));

// Prices include tax and every order ships free, so total equals the merchandise subtotal.
// L = [sku, variant, qty, fulfillment?]
const specs = [
  // Alex Rivera
  { id: "CRUX-48213", c: "C-1001", placed: 2, status: "shipped", eta: 2, carrier: "UPS", lines: [["ROPE-60", "60 m", 1]] },
  { id: "CRUX-47102", c: "C-1001", placed: 21, status: "delivered", delivered: 17, lines: [["VERTEX-LT", "M", 1], ["AUTOBLOCK", "Standard", 1]] },
  { id: "CRUX-46955", c: "C-1001", placed: 40, status: "delivered", delivered: 36, lines: [["QUICKDRAW-12", "12 pack", 1], ["CARAB-HMS", "Screw-lock", 2]] },
  { id: "CRUX-45500", c: "C-1001", placed: 70, status: "delivered", delivered: 65, lines: [["TALON-MID", "US 10", 1]] },
  { id: "CRUX-44210", c: "C-1001", placed: 120, status: "delivered", delivered: 115, lines: [["CRACK-TRAD", "US 10", 1], ["CHALK-BAG", "Standard", 1]] },
  { id: "CRUX-43120", c: "C-1001", placed: 190, status: "refunded", delivered: 186, refundStatus: "refunded", returnStatus: "received",
    lines: [["PIVOT-SLIP", "US 10", 1]], extra: [[180, "Return started"], [176, "Return received at the warehouse"], [174, "Refund issued to the original card"]], refund: { daysAgo: 174 } },
  { id: "CRUX-42050", c: "C-1001", placed: 260, status: "delivered", delivered: 255, lines: [["ROPE-DRY", "70 m", 1]] },
  { id: "CRUX-40388", c: "C-1001", placed: 330, status: "delivered", delivered: 325, lines: [["ALPINE-RACK", "Standard", 1], ["NUT-SET", "Standard", 1]] },
  { id: "CRUX-36004", c: "C-1001", placed: 540, status: "delivered", delivered: 535, lines: [["BELAY-JKT", "L", 1]] },

  // Jordan Lee
  { id: "CRUX-48301", c: "C-1002", placed: 1, status: "processing", eta: 5, lines: [["BOULDER-PRO", "Standard", 1]] },
  { id: "CRUX-46777", c: "C-1002", placed: 12, status: "delivered", delivered: 9, lines: [["ALPINE-RACK", "Standard", 1]] },
  { id: "CRUX-45120", c: "C-1002", placed: 45, status: "return_received", delivered: 41, returnStatus: "received", refundStatus: "pending",
    lines: [["PIVOT-SLIP", "US 9", 1], ["CHALK-BAG", "Standard", 1]], extra: [[12, "Return started"], [6, "Return received at the warehouse, refund processing"]] },
  { id: "CRUX-43880", c: "C-1002", placed: 140, status: "delivered", delivered: 136, lines: [["GYM-CINDER", "M", 1], ["AUTOBLOCK", "Standard", 1]] },

  // Sam Patel
  { id: "CRUX-48190", c: "C-1003", placed: 5, status: "out_for_delivery", eta: 0, shipped: 3, carrier: "UPS", lines: [["HELMET-CX", "M/L", 1], ["CHALK-BAG", "Standard", 2]] },
  { id: "CRUX-47320", c: "C-1003", placed: 9, status: "delivered", delivered: 6, lines: [["ROPE-DRY", "60 m", 2]] },
  { id: "CRUX-46001", c: "C-1003", placed: 29, status: "delivered", delivered: 25, lines: [["BELAY-JKT", "L", 1]] },
  { id: "CRUX-45990", c: "C-1003", placed: 20, status: "delivered", delivered: 16, refundStatus: "refunded", returnStatus: "received",
    lines: [["QUICKDRAW-6", "6 pack", 1]], extra: [[12, "Return started, gate defect reported"], [8, "Return received at the warehouse"], [6, "Refund issued to the original card"]], refund: { daysAgo: 6 } },
  { id: "CRUX-44700", c: "C-1003", placed: 80, status: "delivered", delivered: 76, lines: [["SUMMIT-ALP", "L", 1], ["TUBE-BELAY", "Standard", 1]] },
  { id: "CRUX-43010", c: "C-1003", placed: 150, status: "delivered", delivered: 145, lines: [["ALPINE-RACK", "Standard", 1], ["NUT-SET", "Standard", 1]] },
  { id: "CRUX-41222", c: "C-1003", placed: 240, status: "delivered", delivered: 235, lines: [["STATIC-10", "50 m", 1], ["WEB-TUBE", "60 ft", 3]] },
  { id: "CRUX-39860", c: "C-1003", placed: 400, status: "delivered", delivered: 395, lines: [["WALL-HAUL", "L", 1], ["CARAB-HMS", "Twist-lock", 4]] },

  // Morgan Chen
  { id: "CRUX-48266", c: "C-1004", placed: 2, status: "backordered", eta: 6, lines: [["VERTEX-LT", "M", 1, "backordered"]] },
  { id: "CRUX-48250", c: "C-1004", placed: 3, status: "partially_shipped", eta: 2, carrier: "UPS", shipped: 2,
    lines: [["EDGE-LV", "US 9", 1, "shipped"], ["ALPINE-RACK", "Standard", 1, "backordered"]],
    extra: [[0, "Cams are backordered, we will ship them as soon as they arrive (about 14 days)"]], backorderEta: 14 },
  { id: "CRUX-48044", c: "C-1004", placed: 8, status: "shipped", eta: 4, carrier: "USPS", shipped: 7, lines: [["TALON-MID", "US 9", 1]],
    exception: "Delayed by severe weather", extra: [[2, "Delayed by severe weather"]] },
  { id: "CRUX-47555", c: "C-1004", placed: 15, status: "cancelled", cancelled: 14, lines: [["CHALK-BAG", "Standard", 1]] },
  { id: "CRUX-46410", c: "C-1004", placed: 26, status: "return_in_transit", delivered: 22, returnStatus: "in_transit",
    lines: [["QUICKDRAW-12", "12 pack", 1]], extra: [[3, "Return started, label sent"], [1, "Return in transit to the warehouse"]] },

  // Taylor Brooks (account closed)
  { id: "CRUX-40111", c: "C-1005", placed: 400, status: "delivered", delivered: 395, lines: [["HELMET-CX", "S/M", 1]] },
  { id: "CRUX-38800", c: "C-1005", placed: 520, status: "delivered", delivered: 515, lines: [["EDGE-LV", "US 8", 1], ["CHALK-BAG", "Standard", 1]] },
  { id: "CRUX-37250", c: "C-1005", placed: 650, status: "delivered", delivered: 645, lines: [["ROPE-60", "60 m", 1]] },
];

const money = (n) => Math.round(n * 100) / 100;
const last4 = (id) => String((Number(id.replace(/\D/g, "")) * 7919) % 10000).padStart(4, "0");

const orders = specs.map((s) => {
  const lines = s.lines.map(([sku, variant, qty, fulfillment]) => {
    const line = { sku, variant, qty, unitPrice: price[sku] };
    if (fulfillment) line.fulfillment = fulfillment;
    return line;
  });
  const subtotal = money(lines.reduce((t, l) => t + l.unitPrice * l.qty, 0));
  const shipsOut = !["processing", "backordered", "cancelled"].includes(s.status);
  const shipped = s.shipped ?? (shipsOut ? Math.max(s.placed - 1, s.delivered ?? 0) : undefined);

  const events = [[s.placed, "Order placed"], [s.placed, "Payment confirmed"]];
  if (s.status === "processing") events.push([s.placed, "Packing at the Crux warehouse"]);
  if (s.status === "backordered") events.push([s.placed, "Waiting on stock, we will ship as soon as it arrives"]);
  if (s.status === "cancelled") events.push([s.cancelled, "Order cancelled, payment refunded"]);
  if (shipsOut) events.push([shipped, "Shipped"]);
  if (s.status === "out_for_delivery") events.push([0, "Out for delivery"]);
  if (s.delivered !== undefined) events.push([s.delivered, "Delivered"]);
  (s.extra || []).forEach((e) => events.push(e));
  const timeline = events.sort((a, b) => b[0] - a[0]).map(([daysAgo, event]) => ({ daysAgo, event }));

  const order = {
    id: s.id, customerId: s.c, placedDaysAgo: s.placed, status: s.status, lines,
    subtotal, shipping: 0, tax: 0, total: subtotal,
    shipTo: cust[s.c].address, shippingMethod: "Standard, free",
  };
  if (shipsOut) { order.carrier = s.carrier || "UPS"; order.trackingLast4 = last4(s.id); }
  if (s.eta !== undefined) order.etaDaysFromNow = s.eta;
  if (s.delivered !== undefined) order.deliveredDaysAgo = s.delivered;
  if (s.exception) order.exception = s.exception;
  if (s.backorderEta) order.backorderEtaDaysFromNow = s.backorderEta;
  if (s.returnStatus) order.returnStatus = s.returnStatus;
  order.refundStatus = s.refundStatus || "none";
  if (s.refund) order.refund = { amount: subtotal, daysAgo: s.refund.daysAgo };
  order.timeline = timeline;
  return order;
});

writeFileSync(join(root, "data/orders.json"), JSON.stringify({ orders }, null, 2) + "\n");
console.log(`wrote ${orders.length} orders`);
