// Validates data/*.json. Run: node tools/validate.mjs  (exits 1 on any failure)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));
const catalog = load("catalog.json");
const customers = load("customers.json").customers;
const orders = load("orders.json").orders;

const errors = [];
const check = (ok, msg) => { if (!ok) errors.push(msg); };

const STATUSES = ["processing", "shipped", "out_for_delivery", "delivered", "cancelled", "backordered", "partially_shipped", "return_in_transit", "return_received", "refunded"];
const catIds = new Set(catalog.categories.map((c) => c.id));
const products = Object.fromEntries(catalog.products.map((p) => [p.sku, p]));

// Products
check(catalog.products.length === 24, `expected 24 products, found ${catalog.products.length}`);
check(Object.keys(products).length === catalog.products.length, "duplicate SKU in catalog");
for (const c of catalog.categories) {
  const n = catalog.products.filter((p) => p.category === c.id).length;
  check(n === 4, `category ${c.id} has ${n} products, expected 4`);
}
for (const p of catalog.products) {
  check(catIds.has(p.category), `${p.sku}: unknown category ${p.category}`);
  check(p.price > 0, `${p.sku}: bad price`);
  check(p.variants.length > 0, `${p.sku}: no variants`);
  const labels = p.variants.map((v) => v.label);
  check(new Set(labels).size === labels.length, `${p.sku}: duplicate variant label`);
  check(p.variants.every((v) => Number.isInteger(v.stock) && v.stock >= 0), `${p.sku}: bad stock`);
  const outAll = p.variants.every((v) => v.stock === 0);
  const outAny = p.variants.some((v) => v.stock === 0);
  check(!outAny || p.restockDays > 0, `${p.sku}: has an out-of-stock variant but restockDays is 0`);
  check(!outAll || p.restockDays > 0, `${p.sku}: fully out of stock without restockDays`);
  for (const r of p.relatedSkus) check(products[r] && r !== p.sku, `${p.sku}: bad related SKU ${r}`);
  for (const k of ["name", "shortDescription", "longDescription", "image", "specs", "features", "searchKeywords", "disciplines"]) check(p[k] && (typeof p[k] !== "object" || Object.keys(p[k]).length), `${p.sku}: missing ${k}`);
}

// Customers
const custIds = new Set(customers.map((c) => c.customerId));
check(customers.length === 5, `expected 5 customers, found ${customers.length}`);
check(new Set(customers.map((c) => c.phone)).size === customers.length, "duplicate phone");
for (const c of customers) {
  check(/^\d{10}$/.test(c.phone), `${c.customerId}: phone must be 10 digits`);
  check(/^\d{5}$/.test(c.zip) && c.zip === c.address.zip, `${c.customerId}: zip mismatch`);
  check(["Basecamp", "Summit Club"].includes(c.tier), `${c.customerId}: unknown tier ${c.tier}`);
}

// Orders
const ids = new Set();
for (const o of orders) {
  check(!ids.has(o.id), `duplicate order id ${o.id}`);
  ids.add(o.id);
  check(custIds.has(o.customerId), `${o.id}: unknown customer`);
  check(STATUSES.includes(o.status), `${o.id}: bad status ${o.status}`);
  let sub = 0;
  for (const l of o.lines) {
    const p = products[l.sku];
    check(!!p, `${o.id}: unknown SKU ${l.sku}`);
    if (!p) continue;
    check(p.variants.some((v) => v.label === l.variant), `${o.id}: ${l.sku} has no variant "${l.variant}"`);
    check(l.unitPrice === p.price, `${o.id}: ${l.sku} unitPrice differs from catalog`);
    sub += l.unitPrice * l.qty;
  }
  check(Math.abs(sub - o.subtotal) < 0.005, `${o.id}: subtotal ${o.subtotal} != ${sub.toFixed(2)}`);
  check(Math.abs(o.subtotal + o.shipping + o.tax - o.total) < 0.005, `${o.id}: total does not add up`);
  if (o.deliveredDaysAgo !== undefined) check(o.deliveredDaysAgo < o.placedDaysAgo, `${o.id}: delivered before placed`);
  const tl = o.timeline.map((t) => t.daysAgo);
  check(tl.every((d, i) => i === 0 || d <= tl[i - 1]), `${o.id}: timeline not in time order`);
  check(tl.every((d) => d <= o.placedDaysAgo), `${o.id}: timeline event before order was placed`);
  if (["shipped", "out_for_delivery", "partially_shipped"].includes(o.status)) check(o.etaDaysFromNow !== undefined && o.trackingLast4, `${o.id}: in transit without eta or tracking`);
  if (o.status === "delivered") check(o.deliveredDaysAgo !== undefined, `${o.id}: delivered without date`);
  if (o.status === "backordered") check(o.lines.every((l) => l.fulfillment === "backordered"), `${o.id}: backordered lines not flagged`);
  if (o.status === "partially_shipped") check(o.lines.some((l) => l.fulfillment === "shipped") && o.lines.some((l) => l.fulfillment === "backordered"), `${o.id}: partial order needs shipped and backordered lines`);
  if (o.status === "refunded") check(o.refundStatus === "refunded" && o.refund, `${o.id}: refunded status needs refund details`);
}

// Existing demo orders and the facts the voice tests rely on
const byId = Object.fromEntries(orders.map((o) => [o.id, o]));
const required = {
  "CRUX-48213": ["C-1001", "shipped"], "CRUX-47102": ["C-1001", "delivered"], "CRUX-45500": ["C-1001", "delivered"],
  "CRUX-48301": ["C-1002", "processing"], "CRUX-46777": ["C-1002", "delivered"],
  "CRUX-48190": ["C-1003", "out_for_delivery"], "CRUX-46001": ["C-1003", "delivered"], "CRUX-45990": ["C-1003", "delivered"],
  "CRUX-48044": ["C-1004", "shipped"], "CRUX-47555": ["C-1004", "cancelled"],
};
for (const [id, [cid, status]] of Object.entries(required)) {
  check(byId[id], `existing order ${id} is missing`);
  if (byId[id]) { check(byId[id].customerId === cid, `${id}: wrong customer`); check(byId[id].status === status, `${id}: status changed from ${status}`); }
}
check(byId["CRUX-47102"]?.total === 144.49, "CRUX-47102 total must stay 144.49");
check(byId["CRUX-46777"]?.total === 310, "CRUX-46777 total must stay 310");
check(byId["CRUX-45990"]?.refundStatus === "refunded", "CRUX-45990 must stay already refunded");
check(byId["CRUX-48044"]?.exception === "Delayed by severe weather", "CRUX-48044 exception text changed");

// Order counts per customer
const want = { "C-1001": 9, "C-1002": 4, "C-1003": 8, "C-1004": 5, "C-1005": 3 };
for (const [cid, n] of Object.entries(want)) {
  const got = orders.filter((o) => o.customerId === cid).length;
  check(got === n, `${cid}: expected ${n} orders, found ${got}`);
}

// Demo stock design from the plan
check(products["VERTEX-LT"].variants.find((v) => v.label === "M").stock === 0, "Vertex LT medium must be out of stock");
check(products["ALPINE-RACK"].variants.every((v) => v.stock === 0), "Alpine Rack must be fully out of stock");
check(products["BOULDER-PRO"].variants[0].stock === 2, "Boulder Pro must have stock 2");

if (errors.length) {
  console.error(`FAILED (${errors.length}):\n- ` + errors.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${catalog.products.length} products, ${customers.length} customers, ${orders.length} orders`);
