// App shell for the Crux storefront: hash router, header, footer, cart drawer, toasts and the Beta page-context handoff.
// It is a single page on purpose: moving between pages never reloads, so a live call with Beta stays connected.
import { $, $$, esc, money, loadData, D, cat, getUser, getCart, cartCount, totals, cartLines, stockOf, findOrder, STATUS } from "./lib.js";
import * as V from "./views.js";

const parse = () => {
  const raw = location.hash.slice(1) || "/", [path, qs] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs || "") };
};
const routeFor = (r) => {
  const k = r.parts[0] || "";
  if (k === "orders") return r.parts[1] ? V.order : V.orders;
  return { "": V.home, shop: V.shop, product: V.product, cart: V.cart, checkout: V.checkout, confirmation: V.confirmation, account: V.account, support: V.support }[k] || V.notFound;
};

// ---------- shell ----------
function header() {
  const u = getUser(), n = cartCount();
  $("#site-header").innerHTML = `<div class="wrap hdr">
    <a class="brand" href="#/"><img src="assets/brand/logo.svg" alt=""><span>Crux Outdoor Co.<small>Climbing gear</small></span></a>
    <button class="icon-btn menu-toggle" id="menu" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="nav" id="nav" aria-label="Main"><a href="#/shop">Shop all</a><a href="#/shop?cat=ropes-soft-goods">Ropes</a><a href="#/shop?cat=shoes">Shoes</a><a href="#/shop?cat=harnesses">Harnesses</a><a href="#/support">Support</a></nav>
    <form class="search" id="search" role="search"><input type="text" name="q" placeholder="Search gear" aria-label="Search gear"><button type="submit" aria-label="Search">Go</button></form>
    <div class="hdr-actions"><a class="icon-btn" href="#/account">${u ? "Hi, " + esc(u.firstName) : "Sign in"}</a>
    <button class="icon-btn" id="cart-btn" aria-label="Open cart, ${n} items">Cart <span class="badge-count">${n}</span></button></div></div>`;
  $("#search").addEventListener("submit", (e) => { e.preventDefault(); const q = new FormData(e.target).get("q").toString().trim(); if (q) location.hash = "#/shop?q=" + encodeURIComponent(q); });
  $("#menu").addEventListener("click", (e) => { const o = $("#nav").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(o)); });
  $("#cart-btn").addEventListener("click", openDrawer);
  markNav();
}
function markNav() {
  const r = parse(), cur = "#/" + r.parts.join("/") + (r.parts[0] === "shop" && r.query.get("cat") ? "?cat=" + r.query.get("cat") : "");
  $$("#nav a").forEach((a) => { if (a.getAttribute("href") === cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
function footer() {
  $("#site-footer").innerHTML = `<div class="wrap"><div class="foot-grid"><div><h4>Crux Outdoor Co.</h4><p class="small">Climbing gear from people who climb. Beta, our voice guide, is on the line from every page.</p></div>
    <div><h4>Shop</h4><ul>${D.catalog.categories.map((c) => `<li><a href="#/shop?cat=${c.id}">${esc(c.name)}</a></li>`).join("")}</ul></div>
    <div><h4>Account</h4><ul><li><a href="#/account">Sign in</a></li><li><a href="#/orders">Order history</a></li><li><a href="#/cart">Cart</a></li></ul></div>
    <div><h4>Help</h4><ul><li><a href="#/support">Returns and shipping</a></li><li><a href="#/support">Membership and points</a></li><li><a href="#/support">Talk to Beta</a></li></ul></div></div>
    <p class="fine">${esc(D.catalog.policies.shipping.footnote)}</p>
    <p class="fine"><b>This is a fictional demo store.</b> Crux Outdoor Co. is not a real retailer, no payments are taken, and calls to Beta may be recorded and transcribed for the demo. Please do not share real personal information.</p></div>`;
}

// ---------- drawer ----------
function drawerHTML() {
  const t = totals();
  if (!t.lines.length) return { body: `<div class="empty"><p>Your cart is empty.</p><a class="btn small" href="#/shop">Shop gear</a></div>`, foot: "" };
  return { body: t.lines.map(V.lineHTML).join(""), foot: V.summaryHTML(t, false) + `<a class="btn" href="#/checkout" style="width:100%;margin-top:10px">Checkout</a><a class="btn secondary" href="#/cart" style="width:100%;margin-top:8px">View cart</a>` };
}
function paintDrawer() { const d = drawerHTML(); $("#drawer-body").innerHTML = d.body; $("#drawer-foot").innerHTML = d.foot; }
let lastFocus = null;
function openDrawer() { lastFocus = document.activeElement; paintDrawer(); $("#drawer").classList.add("open"); $("#scrim").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#drawer-close").focus(); }
function closeDrawer() { const was = $("#drawer").classList.contains("open"); $("#drawer").classList.remove("open"); $("#scrim").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); if (was && lastFocus) lastFocus.focus(); }

// ---------- toast ----------
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200); }

// ---------- Beta page context ----------
// The widget's sendInfo text reaches the flow as an utterance, so the context rides in the text behind a [[ctx]] marker.
// The flow stores the summary silently and does not reply; Beta then knows what the caller is looking at.
function summarize(ctx) {
  const u = getUser(), parts = [];
  const p = ctx.sku && D.products[ctx.sku];
  if (ctx.page === "product" && p) {
    const st = stockOf(p), out = p.variants.filter((v) => v.stock === 0).map((v) => v.label);
    parts.push(`Product page for ${p.name} (${cat(p.category)?.name || p.category}), ${money(p.price)}, ${st.label}${out.length && st.state !== "out" ? ", sizes out: " + out.join(", ") : ""}`);
  } else if (ctx.page === "shop") {
    const c = ctx.category && cat(ctx.category);
    parts.push("Shop page" + (c ? " showing " + c.name : "") + (ctx.search ? ` searching for ${ctx.search}` : ""));
  } else if (ctx.page === "orders" && ctx.orderId) {
    const o = findOrder(ctx.orderId, u);
    parts.push(`Order detail page for order ${ctx.orderId}` + (o ? `, status ${STATUS[o.status] || o.status}, items ${o.lines.map((l) => D.products[l.sku]?.name || l.sku).join(", ")}` : ""));
  } else if (ctx.page === "orders") parts.push("Order history page");
  else if (ctx.page === "cart") parts.push("Cart page");
  else if (ctx.page === "checkout") parts.push("Checkout page");
  else if (ctx.page === "account") parts.push(u ? "Account page" : "Sign in page");
  else if (ctx.page === "support") parts.push("Support page");
  else if (ctx.page === "home") parts.push("Home page");
  else parts.push(`${ctx.page} page`);
  const lines = cartLines();
  parts.push(lines.length ? "Cart holds " + lines.map((l) => `${l.qty} ${l.p.name} ${l.variant}`).join(", ") : "Cart is empty");
  parts.push(u ? `Signed in on the site as ${u.firstName}` : "Not signed in on the site");
  return parts.join(". ") + ".";
}
function context() {
  const r = parse(), u = getUser(), page = r.parts[0] || "home", ctx = { page, route: location.hash || "#/" };
  if (page === "product") ctx.sku = r.parts[1];
  if (page === "orders" && r.parts[1]) ctx.orderId = r.parts[1];
  if (page === "shop" && r.query.get("cat")) ctx.category = r.query.get("cat");
  if (page === "shop" && r.query.get("q")) ctx.search = r.query.get("q");
  const cart = getCart(); if (cart.length) ctx.cart = cart.map((l) => `${l.sku} ${l.variant} x${l.qty}`);
  ctx.signedInAs = u ? u.firstName : null;
  ctx.summary = summarize(ctx);
  return ctx;
}
let sendTimer, lastSent = "";
function sendContext(extra) {
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => {
    try {
      if (window.CruxBeta && window.CruxBeta.state.session) {
        const c = context(), plain = (s) => String(s || "").replace(/["{}\\~]/g, " "), msg = "[[ctx]] " + plain(c.summary) + " ~~ " + plain(extra);
        if (msg === lastSent) return;
        lastSent = msg; window.CruxBeta.sendInfo(msg, c);
      }
    } catch { /* call not ready, ignore */ }
  }, 400);
}

// ---------- render ----------
let lastKey = "";
function render() {
  const r = parse(), view = routeFor(r)(r), key = r.parts[0] || "";
  document.title = view.title && view.title !== "Crux Outdoor Co." ? view.title + " | Crux Outdoor Co." : "Crux Outdoor Co.";
  const app = $("#app");
  if (view.html !== undefined) app.innerHTML = view.html;
  if (view.after) view.after(app);
  const sameSection = key === lastKey && key === "shop";
  if (!sameSection) window.scrollTo({ top: 0 });
  const h = $("h1", app); if (h && !sameSection) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  lastKey = key; markNav(); closeDrawer(); $("#nav") && $("#nav").classList.remove("open");
  sendContext();
}

async function boot() {
  try { await loadData(); } catch (e) { $("#app").innerHTML = `<div class="wrap empty"><h1>We hit a snag</h1><p>The catalog did not load. If you opened this file directly, serve it over http instead.</p></div>`; return; }
  header(); footer();
  $("#scrim").addEventListener("click", closeDrawer);
  $("#drawer-close").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  $("#drawer").addEventListener("click", (e) => { if (e.target.closest("a")) closeDrawer(); });
  V.bindLines($("#drawer-body"), () => { paintDrawer(); });
  document.addEventListener("cart:change", () => { header(); if ($("#drawer").classList.contains("open")) paintDrawer(); sendContext(); });
  document.addEventListener("session:change", () => { header(); sendContext(); });
  document.addEventListener("drawer:open", openDrawer);
  document.addEventListener("context:change", () => sendContext());
  document.addEventListener("toast", (e) => toast(e.detail));
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-beta]"); if (!b) return;
    toast("Beta is on the line. Tap the call button in the corner to start talking.");
    const hint = $("#hint"); if (hint) { hint.hidden = false; hint.classList.remove("pulse"); void hint.offsetWidth; hint.classList.add("pulse"); }
    sendContext(b.dataset.beta);
  });
  const hint = $("#hint");
  try { if (sessionStorage.getItem("crux.hint") === "0") hint.hidden = true; } catch { /* ignore */ }
  $("#hint-close").addEventListener("click", () => { hint.hidden = true; try { sessionStorage.setItem("crux.hint", "0"); } catch { /* ignore */ } });
  if (window.CruxBeta) window.CruxBeta.onEvent((type) => { if (type === "session") { hint.hidden = true; sendContext(); } if (type === "ended") { lastSent = ""; toast("Call ended. Tap the call button to talk to Beta again."); } });
  window.addEventListener("hashchange", render);
  document.addEventListener("route:refresh", render);
  render();
}
boot();
