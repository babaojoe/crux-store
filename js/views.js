// View functions for the Crux storefront. Each returns { title, html, after(root) }.
import { $, $$, esc, money, D, cat, customer, stockOf, STATUS, OPEN_STATUSES, fmtDate, fmtLong, fmtShort, dateIn, relDay, getUser, signIn, signOut, getCart, cartAdd, cartSet, cartClear, cartLines, getPromo, setPromo, PROMOS, totals, allOrders, findOrder, placeOrder, heroOrderStatusLine, store } from "./lib.js";

const art = (sku) => "assets/products/" + sku + ".svg";
const stars = (r) => "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r));
// Setting the same hash again fires no hashchange, so ask the app to re-render instead.
const go = (hash) => { if (location.hash === hash) document.dispatchEvent(new Event("route:refresh")); else location.hash = hash; };
const sessionChanged = () => document.dispatchEvent(new Event("session:change"));
const toast = (m) => document.dispatchEvent(new CustomEvent("toast", { detail: m }));
const FOOTNOTE = () => D.catalog.policies.shipping.footnote;

function stockTag(p) {
  const s = stockOf(p);
  return `<div class="stock ${s.state}">${esc(s.label)}</div>`;
}
export function productCard(p) {
  const s = stockOf(p);
  const badges = (s.state === "out" ? '<span class="tag red">Out of stock</span>' : s.state === "low" ? '<span class="tag amber">Low stock</span>' : "") + (p.safetyCritical ? "" : "");
  return `<a class="card product-card" href="#/product/${esc(p.sku)}">
    <div class="pc-art"><img src="${art(p.sku)}" alt="" loading="lazy"><div class="pc-badges">${badges}</div></div>
    <div class="pc-body"><div class="pc-brand">${esc(p.brandLine)}</div><h3>${esc(p.name)}</h3>
    <div class="rating" aria-label="Rated ${p.rating} out of 5">${stars(p.rating)} <span>${p.rating} (${p.reviewCount})</span></div>
    <div class="price">${money(p.price)}</div>${stockTag(p)}</div></a>`;
}
const betaCard = (text, ctx) => `<div class="card beta-cta"><img src="assets/brand/beta-avatar.png" alt="Beta"><div><p><b>Ask Beta</b>. ${esc(text)}</p><button class="btn small navy" data-beta="${esc(ctx || "")}">Talk to Beta</button></div></div>`;
const seoNotFound = () => ({ title: "Off route", html: `<div class="wrap empty"><h1>Off route</h1><p>That page does not exist.</p><a class="btn" href="#/">Back to base camp</a></div>` });

// ---------- home ----------
export function home() {
  const pop = [...D.catalog.products].sort((a, b) => b.rating * Math.log(b.reviewCount + 2) - a.rating * Math.log(a.reviewCount + 2)).slice(0, 4);
  const watch = D.catalog.products.filter((p) => stockOf(p).state !== "in" || stockOf(p).outSome).slice(0, 4);
  const tiles = D.catalog.categories.map((c) => {
    const first = D.catalog.products.find((p) => p.category === c.id);
    return `<a class="card cat-tile" href="#/shop?cat=${c.id}"><img src="${art(first.sku)}" alt=""><div class="body"><h3>${esc(c.name)}</h3><p class="muted small">${esc(c.blurb)}</p></div></a>`;
  }).join("");
  const asks = ["Is the Vertex harness back in medium?", "How does the dry rope compare?", "Where is my order?", "Do my loyalty points expire?"];
  return {
    title: "Crux Outdoor Co.",
    html: `<section class="hero"><div class="wrap"><h1>Gear up for the next route</h1><p>Ropes, racks, shoes and harnesses from climbers who use them. Beta is on the line if you want a second opinion.</p>
      <div class="cta"><a class="btn" href="#/shop">Shop all gear</a><button class="btn secondary" data-beta="home">Talk to Beta</button></div></div></section>
    <div class="wrap"><div class="trust">
      <div class="card"><span class="ico">🚚</span><div><b>Free shipping for members*</b><span class="small muted">Basecamp is free to join</span></div></div>
      <div class="card"><span class="ico">↩️</span><div><b>30-day returns</b><span class="small muted">Unused safety gear, tags on</span></div></div>
      <div class="card"><span class="ico">🛡️</span><div><b>90-day defect cover</b><span class="small muted">Damaged or defective, no fuss</span></div></div>
      <div class="card"><span class="ico">🎙️</span><div><b>Beta on the line</b><span class="small muted">Orders, refunds and gear help</span></div></div></div>
    <section class="section"><div class="section-head"><h2>Shop by category</h2><a href="#/shop">View everything</a></div><div class="grid cols-3">${tiles}</div></section>
    <section class="section"><div class="section-head"><h2>Crowd favorites</h2></div><div class="grid cols-4">${pop.map(productCard).join("")}</div></section>
    <section class="section"><div class="section-head"><h2>Almost gone, or on its way back</h2><span class="muted small">Some sizes are out. You can still backorder.</span></div><div class="grid cols-4">${watch.map(productCard).join("")}</div></section>
    <section class="section"><div class="card pad" style="display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center"><img src="assets/brand/beta-avatar.png" alt="Beta" style="width:120px;height:120px;border-radius:50%;border:var(--outline-ink)">
      <div><h2>Meet Beta, your voice guide</h2><p>Tap the call button in the corner and just talk. Beta checks stock, compares gear, tracks orders and handles returns. Try saying:</p>
      <div class="chips">${asks.map((a) => `<span class="chip">“${esc(a)}”</span>`).join("")}</div></div></div></section>
    <p class="small muted" style="margin-top:28px">${esc(FOOTNOTE())}</p></div>`,
  };
}

// ---------- shop ----------
function matchQuery(p, q) {
  const hay = [p.name, p.sku, p.subcategory, p.brandLine, ...p.searchKeywords, ...p.disciplines, cat(p.category).name].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)).every((t) => hay.includes(t));
}
export function shop({ query }) {
  const f = { cat: query.get("cat") || "", q: query.get("q") || "", disc: (query.get("disc") || "").split(",").filter(Boolean), max: Number(query.get("max") || 320), instock: query.get("instock") === "1", sort: query.get("sort") || "featured" };
  let list = D.catalog.products.filter((p) => (!f.cat || p.category === f.cat) && (!f.q || matchQuery(p, f.q)) && p.price <= f.max && (!f.disc.length || f.disc.some((d) => p.disciplines.includes(d))) && (!f.instock || stockOf(p).state !== "out"));
  const sorts = { featured: (a, b) => b.reviewCount - a.reviewCount, "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price, rating: (a, b) => b.rating - a.rating, name: (a, b) => a.name.localeCompare(b.name) };
  list.sort(sorts[f.sort] || sorts.featured);
  const discs = ["sport", "trad", "boulder", "alpine", "gym"];
  const title = f.q ? `Results for “${f.q}”` : f.cat ? cat(f.cat).name : "All gear";
  return {
    title,
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Shop${f.cat ? " / " + esc(cat(f.cat).name) : ""}</div><h1>${esc(title)}</h1>
    <div class="shop"><form class="card filters" id="filters" role="search" aria-label="Filter products">
      <details open><summary class="sr-only">Filters</summary>
      <h3>Category</h3><label><input type="radio" name="cat" value="" ${f.cat ? "" : "checked"}> All gear</label>
      ${D.catalog.categories.map((c) => `<label><input type="radio" name="cat" value="${c.id}" ${f.cat === c.id ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}
      <h3>Climbing style</h3>${discs.map((d) => `<label><input type="checkbox" name="disc" value="${d}" ${f.disc.includes(d) ? "checked" : ""}> ${d[0].toUpperCase() + d.slice(1)}</label>`).join("")}
      <h3>Max price <span id="maxv">${money(f.max)}</span></h3><input type="range" name="max" min="20" max="320" step="10" value="${f.max}" aria-label="Maximum price">
      <h3>Availability</h3><label><input type="checkbox" name="instock" value="1" ${f.instock ? "checked" : ""}> Hide out of stock</label>
      <input type="hidden" name="q" value="${esc(f.q)}"><input type="hidden" name="sort" value="${esc(f.sort)}">
      <p style="margin:14px 0 0"><a href="#/shop">Clear filters</a></p></details></form>
    <section><div class="shop-bar"><span class="muted" aria-live="polite">${list.length} product${list.length === 1 ? "" : "s"}</span>
      <label>Sort <select id="sort">${[["featured", "Most popular"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["rating", "Top rated"], ["name", "Name"]].map(([v, l]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${list.length ? `<div class="grid cols-3">${list.map(productCard).join("")}</div>` : `<div class="card pad empty"><h2>Nothing matches</h2><p>Try fewer filters, or ask Beta to help you find the right gear.</p><a class="btn" href="#/shop">Clear filters</a></div>`}</section></div></div>`,
    after(root) {
      const form = $("#filters", root), apply = () => {
        const fd = new FormData(form), qs = new URLSearchParams();
        for (const k of ["cat", "q"]) if (fd.get(k)) qs.set(k, fd.get(k));
        const d = fd.getAll("disc"); if (d.length) qs.set("disc", d.join(","));
        if (Number(fd.get("max")) < 320) qs.set("max", fd.get("max"));
        if (fd.get("instock")) qs.set("instock", "1");
        const s = $("#sort", root).value; if (s !== "featured") qs.set("sort", s);
        go("#/shop" + (qs.toString() ? "?" + qs : ""));
      };
      form.addEventListener("change", apply);
      form.addEventListener("input", (e) => { if (e.target.name === "max") $("#maxv", root).textContent = money(e.target.value); });
      $("#sort", root).addEventListener("change", apply);
    },
  };
}

// ---------- product ----------
export function product({ parts }) {
  const p = D.products[parts[1]];
  if (!p) return seoNotFound();
  const c = cat(p.category), s = stockOf(p);
  let vi = Math.max(0, p.variants.findIndex((v) => v.stock > 0)), qty = 1;
  const related = p.relatedSkus.map((k) => D.products[k]).filter(Boolean);
  const vstatus = () => {
    const v = p.variants[vi];
    if (v.stock === 0) return { cls: "out", msg: `Out of stock in ${v.label}. Backorder now and it ships around ${fmtShort(dateIn(p.restockDays || 7))}.`, btn: "Backorder" };
    if (v.stock <= 3) return { cls: "low", msg: `Only ${v.stock} left in ${v.label}.`, btn: "Add to cart" };
    return { cls: "in", msg: `In stock in ${v.label}.`, btn: "Add to cart" };
  };
  const vs = vstatus();
  return {
    title: p.name,
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / <a href="#/shop?cat=${c.id}">${esc(c.name)}</a> / ${esc(p.name)}</div>
    <div class="pdp"><div class="card pdp-art"><img src="${art(p.sku)}" alt="${esc(p.name)}"></div>
    <div><div class="pc-brand">${esc(p.brandLine)} · ${esc(p.subcategory)}</div><h1>${esc(p.name)}</h1>
      <div class="rating">${stars(p.rating)} <span>${p.rating} · ${p.reviewCount} reviews</span></div>
      <p class="price" style="margin:10px 0">${money(p.price)}</p><p>${esc(p.shortDescription)}</p>
      <div class="field"><b>${p.variants.length > 1 || p.variants[0].label !== "Standard" ? "Choose an option" : "Option"}</b></div>
      <div class="variants" role="group" aria-label="Options">${p.variants.map((v, i) => `<button class="variant ${v.stock === 0 ? "oos" : ""}" data-i="${i}" aria-pressed="${i === vi}">${esc(v.label)}</button>`).join("")}</div>
      <div class="stock ${vs.cls}" id="vstatus" aria-live="polite">${esc(vs.msg)}</div>
      <div class="buy-row"><div class="qty" role="group" aria-label="Quantity"><button id="dec" aria-label="Fewer">−</button><span id="qty" aria-live="polite">1</span><button id="inc" aria-label="More">+</button></div><button class="btn" id="add">${vs.btn}</button></div>
      <p class="small muted">${esc(s.label)} overall. ${D.catalog.policies.shipping.footnote.split(". ")[0].replace("*", "")}.*</p>
      ${p.safetyCritical ? `<div class="notice"><b>Safety-critical gear.</b> Inspect it before every climb and learn to use it with a qualified instructor. Unused items with tags attached can be returned within 30 days.</div>` : ""}
      ${betaCard("Not sure about size, fit or which one suits your climbing? Ask out loud while you browse.", "product:" + p.sku)}
      <h3>Why climbers like it</h3><ul class="features">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div></div>
    <div class="grid cols-2" style="margin-top:28px"><div class="card pad"><h2>Details</h2><p>${esc(p.longDescription)}</p><p class="small muted">Best for: ${p.disciplines.map(esc).join(", ")}.</p></div>
    <div class="card pad"><h2>Specs</h2><table class="specs">${Object.entries(p.specs).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table></div></div>
    <section class="section"><div class="section-head"><h2>Pairs well with</h2></div><div class="grid cols-3">${related.map(productCard).join("")}</div></section></div>`,
    after(root) {
      const paint = () => {
        $$(".variant", root).forEach((b, i) => b.setAttribute("aria-pressed", String(i === vi)));
        const st = vstatus(); const el = $("#vstatus", root); el.className = "stock " + st.cls; el.textContent = st.msg; $("#add", root).textContent = st.btn; $("#qty", root).textContent = qty;
        document.dispatchEvent(new Event("context:change"));
      };
      $$(".variant", root).forEach((b) => b.addEventListener("click", () => { vi = Number(b.dataset.i); paint(); }));
      $("#dec", root).addEventListener("click", () => { qty = Math.max(1, qty - 1); paint(); });
      $("#inc", root).addEventListener("click", () => { qty = Math.min(10, qty + 1); paint(); });
      $("#add", root).addEventListener("click", () => { cartAdd(p.sku, p.variants[vi].label, qty); toast(`Added ${qty} × ${p.name} (${p.variants[vi].label})`); document.dispatchEvent(new Event("drawer:open")); });
    },
  };
}

// ---------- cart ----------
export function summaryHTML(t, withShipNote = true) {
  const pol = D.catalog.policies.shipping;
  return `<div class="sum-row"><span>Subtotal</span><span>${money(t.sub)}</span></div>${t.discount ? `<div class="sum-row"><span>Promo ${esc(t.promo)}</span><span>−${money(t.discount)}</span></div>` : ""}
  <div class="sum-row"><span>Shipping${t.member ? " (member)*" : "*"}</span><span>${t.shipping === 0 ? "Free" : money(t.shipping)}</span></div>
  <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>
  ${withShipNote ? `<p class="small muted" style="margin-top:8px">${t.member ? "Free standard shipping for members." : "Free standard shipping for members. Guests pay " + money(pol.guestStandard) + ", free over " + money(pol.guestFreeOver) + "."} Prices include tax.</p>` : ""}`;
}
export function lineHTML(l) {
  return `<div class="line"><img src="${art(l.sku)}" alt=""><div><h3><a href="#/product/${esc(l.sku)}">${esc(l.p.name)}</a></h3><div class="small muted">${esc(l.variant)}${l.backorder ? ' · <span class="tag amber">Backorder</span>' : ""}</div>
    <div class="ctl"><div class="qty" role="group" aria-label="Quantity for ${esc(l.p.name)}"><button data-act="dec" data-sku="${esc(l.sku)}" data-v="${esc(l.variant)}" aria-label="Fewer">−</button><span>${l.qty}</span><button data-act="inc" data-sku="${esc(l.sku)}" data-v="${esc(l.variant)}" aria-label="More">+</button></div>
    <button class="link-btn small" data-act="rm" data-sku="${esc(l.sku)}" data-v="${esc(l.variant)}">Remove</button></div></div><div class="price">${money(l.lineTotal)}</div></div>`;
}
export function bindLines(root, rerender) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const l = getCart().find((x) => x.sku === b.dataset.sku && x.variant === b.dataset.v); if (!l) return;
    cartSet(l.sku, l.variant, b.dataset.act === "inc" ? l.qty + 1 : b.dataset.act === "dec" ? l.qty - 1 : 0);
    rerender();
  });
}
export function cart() {
  const render = (root) => {
    const t = totals(), box = $("#cart-box", root);
    if (!t.lines.length) { box.innerHTML = `<div class="card pad empty"><h2>Your cart is empty</h2><p>Time to pick some gear.</p><a class="btn" href="#/shop">Start shopping</a></div>`; return; }
    box.innerHTML = `<div class="cart-layout"><div class="card pad">${t.lines.map(lineHTML).join("")}</div>
      <aside class="card pad"><h2>Order summary</h2><form class="promo" id="promo"><input type="text" name="code" placeholder="Promo code" aria-label="Promo code" value="${esc(getPromo())}"><button class="btn small secondary" type="submit">Apply</button></form>
      <p class="small muted" id="promomsg">${t.promo ? "Applied: " + esc(PROMOS[t.promo].label) : "Try WELCOME10."}</p>${summaryHTML(t)}
      <a class="btn" href="#/checkout" style="width:100%;margin-top:14px">Checkout</a>${getUser() ? "" : `<p class="small center" style="margin-top:10px"><a href="#/account">Sign in</a> for free member shipping*.</p>`}</aside></div>`;
    $("#promo", root).addEventListener("submit", (e) => { e.preventDefault(); const c = new FormData(e.target).get("code").toString().trim().toUpperCase(); if (!c || PROMOS[c]) { setPromo(c); render(root); } else $("#promomsg", root).textContent = "That code is not valid."; });
  };
  return {
    title: "Your cart",
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / Cart</div><h1>Your cart</h1><div id="cart-box"></div><p class="small muted" style="margin-top:14px">${esc(FOOTNOTE())}</p></div>`,
    after(root) { render(root); bindLines($("#cart-box", root), () => render(root)); },
  };
}

// ---------- checkout ----------
export function checkout() {
  if (!getCart().length) { go("#/cart"); return { title: "Checkout", html: "" }; }
  const u = getUser(), a = u ? u.address : { name: "", line1: "", city: "", state: "", zip: "" };
  const f = (id, label, val, extra = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="text" value="${esc(val)}" ${extra} required><div class="err" id="e-${id}"></div></div>`;
  const t0 = totals("standard"), pol = D.catalog.policies.shipping;
  return {
    title: "Checkout",
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / <a href="#/cart">Cart</a> / Checkout</div><h1>Checkout</h1>
    <div class="notice info"><b>Demo checkout.</b> No real payment is taken. Please do not enter real card or personal details. The test card is prefilled.</div>
    <div class="cart-layout"><form id="co" novalidate>
      <fieldset><legend>Contact</legend>${f("email", "Email", u ? u.email : "", 'inputmode="email" autocomplete="email"')}</fieldset>
      <fieldset><legend>Ship to</legend><div class="form-grid">${f("name", "Full name", a.name)}${f("line1", "Address", a.line1)}${f("city", "City", a.city)}<div class="form-grid" style="grid-template-columns:1fr 1fr">${f("state", "State", a.state, 'maxlength="2"')}${f("zip", "ZIP", a.zip, 'inputmode="numeric" maxlength="5"')}</div></div></fieldset>
      <fieldset><legend>Shipping method</legend>
        <label class="radio-card"><input type="radio" name="method" value="standard" checked><span><b>Standard</b> · ${t0.shipping === 0 ? "Free" : money(t0.shipping)}<br><span class="small muted">3 to 6 business days${u ? ", free for members*" : ""}</span></span></label>
        <label class="radio-card"><input type="radio" name="method" value="express"><span><b>Express</b> · ${money(pol.express)}<br><span class="small muted">1 to 2 business days</span></span></label></fieldset>
      <fieldset><legend>Payment (test card)</legend><div class="form-grid">${f("card", "Card number", "4242 4242 4242 4242", 'inputmode="numeric" autocomplete="off"')}${f("exp", "Expiry", "12/30", 'placeholder="MM/YY" autocomplete="off"')}${f("cvc", "CVC", "123", 'inputmode="numeric" maxlength="4" autocomplete="off"')}</div></fieldset>
      <button class="btn" type="submit">Place order</button></form>
    <aside class="card pad"><h2>Your order</h2><div id="co-lines">${t0.lines.map((l) => `<div class="sum-row"><span>${l.qty} × ${esc(l.p.name)} <span class="small muted">(${esc(l.variant)})</span></span><span>${money(l.lineTotal)}</span></div>`).join("")}</div><hr style="border:0;border-top:1px solid var(--color-border)"><div id="co-sum">${summaryHTML(t0, false)}</div><p class="small muted">${esc(FOOTNOTE())}</p></aside></div></div>`,
    after(root) {
      const form = $("#co", root);
      form.addEventListener("change", (e) => { if (e.target.name === "method") $("#co-sum", root).innerHTML = summaryHTML(totals(e.target.value), false); });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(form)), errs = {};
        if (!/^\S+@\S+\.\S+$/.test(v.email || "")) errs.email = "Enter a valid email.";
        for (const k of ["name", "line1", "city"]) if (!String(v[k] || "").trim()) errs[k] = "Required.";
        if (!/^[A-Za-z]{2}$/.test(v.state || "")) errs.state = "Two letters.";
        if (!/^\d{5}$/.test(v.zip || "")) errs.zip = "Five digits.";
        if (String(v.card).replace(/\D/g, "").length < 13) errs.card = "Enter the test card.";
        if (!/^\d{2}\/\d{2}$/.test(v.exp || "")) errs.exp = "MM/YY";
        if (!/^\d{3,4}$/.test(v.cvc || "")) errs.cvc = "3 or 4 digits.";
        $$(".err", root).forEach((el) => (el.textContent = ""));
        for (const [k, m] of Object.entries(errs)) $("#e-" + k, root).textContent = m;
        if (Object.keys(errs).length) { $("#" + Object.keys(errs)[0], root).focus(); return; }
        const order = placeOrder({ method: v.method, email: v.email, address: { name: v.name, line1: v.line1, city: v.city, state: v.state.toUpperCase(), zip: v.zip } });
        cartClear(); setPromo(""); go("#/confirmation/" + order.id);
      });
    },
  };
}
export function confirmation({ parts }) {
  const u = getUser(), o = findOrder(parts[1], u);
  if (!o) return seoNotFound();
  return {
    title: "Order placed",
    html: `<div class="wrap" style="max-width:760px"><div class="card pad center" style="margin-top:28px"><img src="assets/brand/beta-avatar.png" alt="" style="width:96px;height:96px;border-radius:50%;border:var(--outline-ink)"><h1>Thanks, your order is in</h1><p>Order <b>${esc(o.id)}</b> is ${esc(STATUS[o.status].toLowerCase())}. ${o.status === "backordered" ? "It ships when the item arrives." : "It should arrive around " + fmtLong(dateIn(o.etaDaysFromNow)) + "."}</p>
      <div class="notice info" style="text-align:left"><b>Demo note.</b> Orders placed here are saved in your browser only, so Beta cannot look them up yet. Ask Beta about the seeded orders on the demo accounts.</div>
      <p><a class="btn" href="${u ? "#/orders/" + esc(o.id) : "#/shop"}">${u ? "View order" : "Keep shopping"}</a></p></div></div>`,
  };
}

// ---------- account ----------
const initials = (c) => c.firstName[0];
const lockedMsg = () => `<div class="wrap" style="max-width:640px"><div class="card pad center" style="margin-top:28px"><h1>This account is closed</h1><p>The account on that phone number was closed, so we can't show orders or points. If that's a mistake, Beta can connect you with a specialist.</p><button class="btn navy" data-beta="closed-account">Talk to Beta</button> <a class="btn secondary" href="#/account">Back</a></div></div>`;
export function account({ query }) {
  const u = getUser();
  if (query.get("closed")) return { title: "Account closed", html: lockedMsg() };
  if (!u) {
    return {
      title: "Sign in",
      html: `<div class="wrap"><h1>Sign in</h1><p class="muted">This is a demo store. Pick a demo customer, or sign in with the phone number and ZIP code, the same two details Beta asks for on a call.</p>
      <div class="grid cols-2"><section><h2>Demo customers</h2><div class="grid">${D.customers.map((c, i) => `<button class="card persona" data-id="${c.customerId}"><span class="avatar c${i + 1}">${esc(initials(c))}</span><span><b>${esc(c.firstName + " " + c.lastName)}</b> <span class="tag ${c.status === "closed" ? "gray" : c.tier === "Summit Club" ? "blue" : "green"}">${c.status === "closed" ? "Closed" : esc(c.tier)}</span><br><span class="small muted">${esc(c.profile.blurb)}</span></span></button>`).join("")}</div></section>
      <section><h2>Phone and ZIP</h2><form class="card pad" id="si" novalidate><div class="field"><label for="ph">Phone number</label><input id="ph" name="ph" type="tel" inputmode="tel" autocomplete="off" placeholder="303 555 0142"></div><div class="field" style="margin-top:12px"><label for="zp">Billing ZIP</label><input id="zp" name="zp" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="80302"></div><div class="err" id="si-err" role="alert" style="color:var(--color-danger);margin:10px 0;min-height:1.2em"></div><button class="btn" type="submit">Sign in</button></form></section></div></div>`,
      after(root) {
        $$(".persona", root).forEach((b) => b.addEventListener("click", () => { const c = customer(b.dataset.id); if (c.status === "closed") return go("#/account?closed=" + c.customerId); signIn(c.customerId); sessionChanged(); toast("Signed in as " + c.firstName); go("#/account"); }));
        $("#si", root).addEventListener("submit", (e) => {
          e.preventDefault();
          const err = $("#si-err", root), ph = $("#ph", root).value.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1"), zp = $("#zp", root).value.replace(/\D/g, "").slice(0, 5);
          const fails = Number(sessionStorage.getItem("crux.fails") || 0);
          if (fails >= 3) { err.textContent = "Too many attempts. Reload the page to try again, or ask Beta."; return; }
          const c = D.customers.find((x) => x.phone === ph);
          if (!c) { err.textContent = "We could not find an account with that phone number."; return; }
          if (c.status === "closed") return go("#/account?closed=" + c.customerId);
          if (c.zip !== zp) { sessionStorage.setItem("crux.fails", String(fails + 1)); err.textContent = fails + 1 >= 3 ? "Too many attempts. Reload the page to try again, or ask Beta." : "That ZIP does not match. " + (2 - fails) + " tries left."; return; }
          sessionStorage.removeItem("crux.fails"); signIn(c.customerId); sessionChanged(); toast("Welcome back, " + c.firstName); go("#/account");
        });
      },
    };
  }
  const orders = allOrders(u), open = orders.filter((o) => OPEN_STATUSES.includes(o.status)), idx = D.customers.indexOf(u);
  const since = fmtDate(dateIn(-u.memberSinceDaysAgo)), val = (u.points / 100).toFixed(2);
  return {
    title: "My account",
    html: `<div class="wrap"><div class="section-head" style="margin-top:24px"><div style="display:flex;gap:16px;align-items:center"><span class="avatar c${idx + 1}" style="width:68px;height:68px;font-size:1.8rem">${esc(initials(u))}</span><div><h1 style="margin:0">Hi, ${esc(u.firstName)}</h1><span class="tag ${u.tier === "Summit Club" ? "blue" : "green"}">${esc(u.tier)}</span> <span class="small muted">Member since ${esc(since)}</span></div></div><button class="btn secondary" id="so">Sign out</button></div>
    <div class="grid cols-3"><div class="card stat"><b>${orders.length}</b>Orders</div><div class="card stat"><b>${open.length}</b>Open orders</div><div class="card stat"><b>${u.points.toLocaleString("en-US")}</b>Points · worth $${val}</div></div>
    <div class="grid cols-2" style="margin-top:20px"><div class="card pad"><h2>Your details</h2><dl class="kv"><dt>Ship to</dt><dd>${esc(u.address.line1)}, ${esc(u.address.city)}, ${esc(u.address.state)} ${esc(u.address.zip)}</dd><dt>Payment</dt><dd>${u.savedPayment ? esc(u.savedPayment.brand) + " ending " + esc(u.savedPayment.last4) : "None saved"}</dd><dt>Contact by</dt><dd>${esc(u.commPreference)}</dd><dt>Email</dt><dd>${esc(u.email)}</dd></dl></div>
    <div class="card pad"><h2>Your climbing</h2><dl class="kv"><dt>Style</dt><dd>${u.profile.disciplines.map(esc).join(", ")}</dd><dt>Level</dt><dd>${esc(u.profile.level)}</dd><dt>Shoe size</dt><dd>${esc(u.profile.shoeSize)}</dd><dt>Harness</dt><dd>${esc(u.profile.harnessSize)}</dd></dl></div></div>
    <div class="section-head" style="margin-top:28px"><h2>Recent orders</h2><a href="#/orders">All orders</a></div>${orders.slice(0, 3).map(orderCard).join("")}
    <div class="card pad"><h2>Past support</h2>${u.supportHistory.length ? u.supportHistory.map((s) => `<p><b>${esc(s.summary)}</b><br><span class="small muted">${esc(fmtDate(dateIn(-s.daysAgo)))} · ${esc(s.resolution)}</span></p>`).join("") : "<p class='muted'>No past tickets.</p>"}</div>
    <p class="small muted" style="margin-top:14px">${esc(FOOTNOTE())}</p></div>`,
    after(root) { $("#so", root).addEventListener("click", () => { signOut(); sessionChanged(); toast("Signed out"); go("#/account"); }); },
  };
}

// ---------- orders ----------
function orderCard(o) {
  const names = o.lines.map((l) => D.products[l.sku].name);
  return `<a class="card order-card" href="#/orders/${esc(o.id)}"><div><b>${esc(o.id)}</b> <span class="status s-${o.status}">${esc(STATUS[o.status])}</span><div class="small muted">Placed ${esc(fmtDate(dateIn(-o.placedDaysAgo)))} · ${esc(heroOrderStatusLine(o))}</div>
    <div>${esc(names.slice(0, 2).join(", "))}${names.length > 2 ? ` and ${names.length - 2} more` : ""}</div><div class="thumbs">${o.lines.slice(0, 5).map((l) => `<img src="${art(l.sku)}" alt="">`).join("")}</div></div><div class="price" style="align-self:center">${money(o.total)}</div></a>`;
}
export function orders({ query }) {
  const u = getUser();
  if (!u) { go("#/account"); return { title: "Orders", html: "" }; }
  const fl = query.get("f") || "all";
  const tests = { all: () => true, open: (o) => OPEN_STATUSES.includes(o.status), delivered: (o) => o.status === "delivered", returns: (o) => ["return_in_transit", "return_received", "refunded"].includes(o.status) || o.refundStatus === "refunded", cancelled: (o) => o.status === "cancelled" };
  const all = allOrders(u), list = all.filter(tests[fl] || tests.all);
  return {
    title: "Order history",
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / <a href="#/account">Account</a> / Orders</div><h1>Order history</h1>
    <div class="chips" role="group" aria-label="Filter orders">${[["all", "All"], ["open", "Open"], ["delivered", "Delivered"], ["returns", "Returns and refunds"], ["cancelled", "Cancelled"]].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${fl === k}">${l} (${all.filter(tests[k]).length})</button>`).join("")}</div>
    ${list.length ? list.map(orderCard).join("") : `<div class="card pad empty"><p>No orders here.</p></div>`}</div>`,
    after(root) { $$(".chip", root).forEach((b) => b.addEventListener("click", () => go("#/orders" + (b.dataset.f === "all" ? "" : "?f=" + b.dataset.f)))); },
  };
}
export function order({ parts }) {
  const u = getUser();
  if (!u) { go("#/account"); return { title: "Order", html: "" }; }
  const o = findOrder(parts[1], u);
  if (!o) return seoNotFound();
  const ship = o.shipTo, held = o.lines.filter((l) => l.fulfillment === "backordered");
  return {
    title: "Order " + o.id,
    html: `<div class="wrap"><div class="crumbs"><a href="#/">Home</a> / <a href="#/orders">Orders</a> / ${esc(o.id)}</div>
    <div class="section-head"><h1 style="margin:0">Order ${esc(o.id)}</h1><span class="status s-${o.status}">${esc(STATUS[o.status])}</span></div>
    <p class="muted">Placed ${esc(fmtDate(dateIn(-o.placedDaysAgo)))} · ${esc(heroOrderStatusLine(o))}</p>
    ${o.exception ? `<div class="notice danger"><b>Heads up:</b> ${esc(o.exception)}.</div>` : ""}
    ${held.length ? `<div class="notice"><b>Backordered:</b> ${held.map((l) => esc(D.products[l.sku].name)).join(", ")}${o.backorderEtaDaysFromNow ? ", expected around " + esc(fmtShort(dateIn(o.backorderEtaDaysFromNow))) : ""}. The rest of your order is not affected.</div>` : ""}
    ${o.refundStatus === "pending" ? `<div class="notice info"><b>Refund processing.</b> We received your return and the refund is on its way.</div>` : ""}${o.refundStatus === "refunded" ? `<div class="notice ok"><b>Refunded.</b> ${o.refund ? money(o.refund.amount) + " went back to the original payment method." : ""}</div>` : ""}
    <div class="detail-grid"><div><div class="card pad"><h2>Items</h2>${o.lines.map((l) => { const p = D.products[l.sku]; return `<div class="line" style="grid-template-columns:72px 1fr auto"><img src="${art(l.sku)}" alt="" style="width:72px;height:72px"><div><h3><a href="#/product/${esc(l.sku)}">${esc(p.name)}</a></h3><div class="small muted">${esc(l.variant)} · Qty ${l.qty}${l.fulfillment === "backordered" ? ' · <span class="tag amber">Backordered</span>' : l.fulfillment === "shipped" ? ' · <span class="tag blue">Shipped</span>' : ""}</div></div><div class="price">${money(l.unitPrice * l.qty)}</div></div>`; }).join("")}
      <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>${o.discount ? `<div class="sum-row"><span>Promo</span><span>−${money(o.discount)}</span></div>` : ""}<div class="sum-row"><span>Shipping</span><span>${o.shipping ? money(o.shipping) : "Free"}</span></div><div class="sum-row total"><span>Total</span><span>${money(o.total)}</span></div></div>
      <div class="card pad" style="margin-top:20px"><h2>Timeline</h2><ol class="timeline">${[...o.timeline].reverse().map((t) => `<li><time>${esc(fmtDate(dateIn(-t.daysAgo)))}</time>${esc(t.event)}</li>`).join("")}</ol></div></div>
    <aside><div class="card pad"><h2>Delivery</h2><dl class="kv" style="grid-template-columns:100px 1fr"><dt>Ship to</dt><dd>${esc(ship.name)}<br>${esc(ship.line1)}<br>${esc(ship.city)}, ${esc(ship.state)} ${esc(ship.zip)}</dd><dt>Method</dt><dd>${esc(o.shippingMethod)}</dd>${o.carrier ? `<dt>Carrier</dt><dd>${esc(o.carrier)}${o.trackingLast4 ? " · tracking ends " + esc(o.trackingLast4) : ""}</dd>` : ""}</dl></div>
    ${betaCard("Need to cancel, return or chase this order? Beta can check it for you out loud.", "order:" + o.id)}
    <p class="small muted">Cancel and return requests are handled by Beta in this demo. Orders you place on this site are saved in your browser only.</p></aside></div></div>`,
  };
}

// ---------- support ----------
export function support() {
  const pol = D.catalog.policies.shipping;
  const qa = [
    ["How do returns work?", `Unused items can be returned within ${D.catalog.policies.returnWindowDays} days of delivery. Safety gear must have its tags attached. Damaged or defective items are covered for ${D.catalog.policies.defectCoverDays} days. Refunds reach your card in 5 to 7 business days.`],
    ["What does shipping cost?", `${pol.footnote.replace("*", "")} Express shipping is ${money(pol.express)}.`],
    ["Can I cancel an order?", "Yes, while it is still processing or waiting on stock. Once any part of an order ships, the whole order can no longer be cancelled, but you can return the shipped items after delivery."],
    ["How do points and membership work?", "Basecamp is free and earns 1 point per dollar. Summit Club starts at 1,000 points and earns 2 points per dollar, with early access to sales. One hundred points are worth one dollar at checkout."],
    ["How do I pick a size?", "Climbing shoes should fit snug but never painful, usually a half to a full size under your street size. Harnesses are sized by waist, so size up between sizes or if you wear thick layers. Beta can walk you through it."],
    ["When can I reach a person?", "Support agents are available every day from 6 AM to 10 PM Mountain. Beta can also set up a callback."],
  ];
  return {
    title: "Support",
    html: `<div class="wrap" style="max-width:860px"><div class="crumbs"><a href="#/">Home</a> / Support</div><h1>How can we help?</h1>${betaCard("Call Beta for orders, refunds, stock checks and gear questions. It is the fastest way to get an answer.", "support")}
    <div class="card pad">${qa.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div><p class="small muted" style="margin-top:14px">${esc(FOOTNOTE())}</p></div>`,
  };
}

export { seoNotFound as notFound };
