// Shared helpers, data loading, cart and session state for the Crux storefront.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (n) => "$" + Number(n).toFixed(2);
export const DAY = 86400000;

// localStorage can throw (private windows, blocked storage), so every use is guarded.
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const dateIn = (days) => new Date(Date.now() + days * DAY);
export const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const fmtLong = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export function relDay(days) { // days relative to today, negative is the past
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return fmtShort(dateIn(days));
}

export const STATUS = {
  processing: "Processing", backordered: "Backordered", partially_shipped: "Partly shipped", shipped: "Shipped", out_for_delivery: "Out for delivery",
  delivered: "Delivered", cancelled: "Cancelled", return_in_transit: "Return in transit", return_received: "Return received", refunded: "Refunded",
};
export const OPEN_STATUSES = ["processing", "backordered", "partially_shipped", "shipped", "out_for_delivery"];

// ---------- data ----------
export const D = { catalog: null, products: {}, customers: [], baseOrders: [] };
export async function loadData() {
  const get = (f) => fetch("data/" + f).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); });
  const [catalog, customers, orders] = await Promise.all([get("catalog.json"), get("customers.json"), get("orders.json")]);
  D.catalog = catalog;
  D.products = Object.fromEntries(catalog.products.map((p) => [p.sku, p]));
  D.customers = customers.customers;
  D.baseOrders = orders.orders;
}
export const cat = (id) => D.catalog.categories.find((c) => c.id === id);
export const customer = (id) => D.customers.find((c) => c.customerId === id);

export function stockOf(p) {
  const vs = p.variants, total = vs.reduce((t, v) => t + v.stock, 0);
  const outSome = vs.some((v) => v.stock === 0);
  const state = total === 0 ? "out" : total <= 3 ? "low" : "in";
  const restock = p.restockDays ? dateIn(p.restockDays) : null;
  const label = state === "out" ? "Out of stock" + (restock ? " · back " + fmtShort(restock) : "") : state === "low" ? "Low stock" : outSome ? "In stock · some sizes out" : "In stock";
  return { state, total, outSome, restock, label };
}

// ---------- session ----------
export const getUser = () => { const s = store.get("crux.session", null); return s ? customer(s.customerId) || null : null; };
export const signIn = (id) => store.set("crux.session", { customerId: id });
export const signOut = () => store.del("crux.session");

// ---------- cart ----------
export const PROMOS = { WELCOME10: { rate: 0.1, label: "10% off" } };
export const getCart = () => store.get("crux.cart", []);
const saveCart = (c) => { store.set("crux.cart", c); document.dispatchEvent(new CustomEvent("cart:change")); };
export function cartAdd(sku, variant, qty = 1) {
  const c = getCart(), hit = c.find((l) => l.sku === sku && l.variant === variant);
  if (hit) hit.qty = Math.min(hit.qty + qty, 10); else c.push({ sku, variant, qty });
  saveCart(c);
}
export function cartSet(sku, variant, qty) {
  let c = getCart();
  c = qty <= 0 ? c.filter((l) => !(l.sku === sku && l.variant === variant)) : c.map((l) => (l.sku === sku && l.variant === variant ? { ...l, qty: Math.min(qty, 10) } : l));
  saveCart(c);
}
export const cartClear = () => saveCart([]);
export const cartCount = () => getCart().reduce((t, l) => t + l.qty, 0);
export function cartLines() {
  return getCart().map((l) => {
    const p = D.products[l.sku];
    if (!p) return null;
    const v = p.variants.find((x) => x.label === l.variant);
    return { ...l, p, backorder: !v || v.stock === 0, lineTotal: p.price * l.qty };
  }).filter(Boolean);
}
export const getPromo = () => store.get("crux.promo", "");
export const setPromo = (c) => (c ? store.set("crux.promo", c) : store.del("crux.promo"));
export function totals(method = "standard") {
  const lines = cartLines(), sub = lines.reduce((t, l) => t + l.lineTotal, 0);
  const promo = PROMOS[getPromo()], discount = promo ? Math.round(sub * promo.rate * 100) / 100 : 0;
  const net = sub - discount, member = !!getUser(), pol = D.catalog.policies.shipping;
  const std = member ? pol.memberStandard : net >= pol.guestFreeOver || net === 0 ? 0 : pol.guestStandard;
  const shipping = method === "express" ? pol.express : std;
  return { lines, sub, discount, shipping, member, total: Math.round((net + shipping) * 100) / 100, promo: promo ? getPromo() : "" };
}

// ---------- orders ----------
const newKey = (u) => "crux.orders." + (u ? u.customerId : "guest");
export function allOrders(user) {
  const base = user ? D.baseOrders.filter((o) => o.customerId === user.customerId) : [];
  const mine = store.get(newKey(user), []).map((o) => {
    const age = Math.floor((Date.now() - o.createdAt) / DAY);
    return { ...o, placedDaysAgo: age, etaDaysFromNow: o.etaDaysFromNow == null ? undefined : o.etaDaysFromNow - age, timeline: o.timeline.map((t) => ({ ...t, daysAgo: t.daysAgo + age })) };
  });
  return [...mine, ...base].sort((a, b) => a.placedDaysAgo - b.placedDaysAgo || (a.id < b.id ? 1 : -1));
}
export function findOrder(id, user) { return allOrders(user).find((o) => o.id === id) || null; }
export function placeOrder({ method, address, email }) {
  const user = getUser(), t = totals(method), key = newKey(user);
  const seq = store.get("crux.orderSeq", 48400) + 1;
  store.set("crux.orderSeq", seq);
  const allBack = t.lines.every((l) => l.backorder), anyBack = t.lines.some((l) => l.backorder);
  const order = {
    id: "CRUX-" + seq, customerId: user ? user.customerId : "guest", createdAt: Date.now(), placedDaysAgo: 0,
    status: allBack ? "backordered" : "processing",
    lines: t.lines.map((l) => ({ sku: l.sku, variant: l.variant, qty: l.qty, unitPrice: l.p.price, ...(l.backorder ? { fulfillment: "backordered" } : {}) })),
    subtotal: t.sub, shipping: t.shipping, tax: 0, total: t.total, discount: t.discount, shipTo: address, email,
    shippingMethod: method === "express" ? "Express" : t.shipping === 0 ? (t.member ? "Standard, free for members" : "Standard, free over $99") : "Standard",
    etaDaysFromNow: method === "express" ? 2 : 5, refundStatus: "none", demoOnly: true,
    timeline: [{ daysAgo: 0, event: "Order placed" }, { daysAgo: 0, event: "Payment confirmed" }, { daysAgo: 0, event: anyBack ? "Part of your order is waiting on stock" : "Packing at the Crux warehouse" }],
  };
  store.set(key, [order, ...store.get(key, [])]);
  return order;
}
export const heroOrderStatusLine = (o) => {
  if (o.status === "delivered") return "Delivered " + relDay(-o.deliveredDaysAgo);
  if (["shipped", "out_for_delivery", "partially_shipped"].includes(o.status) && o.etaDaysFromNow != null) return "Arriving " + relDay(o.etaDaysFromNow);
  if (o.status === "processing") return "Ships soon, expected " + relDay(o.etaDaysFromNow ?? 5);
  if (o.status === "backordered") return "Waiting on stock" + (o.etaDaysFromNow != null ? ", expected " + relDay(o.etaDaysFromNow) : "");
  if (o.status === "return_in_transit") return "Return on its way to us";
  if (o.status === "return_received") return "Return received, refund processing";
  if (o.status === "refunded") return "Refund issued";
  if (o.status === "cancelled") return "Cancelled";
  return "";
};
