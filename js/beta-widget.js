// Loads the self-hosted Cognigy Click To Call widget and connects it to Beta.
// Include after config.js on every page. Exposes window.CruxBeta for page code.
(function () {
  var cfg = window.CRUX_CONFIG || {};
  var state = { ready: false, widget: null, session: null, listeners: [] };

  function emit(type, detail) {
    state.listeners.forEach(function (fn) {
      try { fn(type, detail); } catch (e) { /* listener errors must not break the widget */ }
    });
  }

  window.CruxBeta = {
    state: state,
    onEvent: function (fn) { state.listeners.push(fn); },
    // Send text and optional structured data into the live call (used for page context later).
    sendInfo: function (text, data) {
      if (state.session && typeof state.session.sendInfo === "function") {
        return state.session.sendInfo(text, data);
      }
      return null;
    },
  };

  function init() {
    if (typeof window.initWebRTCWidget !== "function") {
      emit("error", "initWebRTCWidget missing");
      return;
    }
    var p = window.initWebRTCWidget(cfg.betaEndpointUrl);
    Promise.resolve(p).then(function (widget) {
      state.widget = widget;
      state.ready = true;
      emit("ready", widget);
      if (widget && typeof widget.on === "function") {
        widget.on("newRTCSession", function (session) {
          state.session = session;
          emit("session", session);
          if (session && typeof session.on === "function") {
            session.on("ended", function () { state.session = null; emit("ended"); });
            session.on("terminated", function () { state.session = null; emit("ended"); });
          }
        });
      }
    }).catch(function (err) { emit("error", String(err && err.message || err)); });
  }

  var s = document.createElement("script");
  s.src = cfg.widgetScript;
  s.async = true;
  s.onload = function () {
    if (document.readyState === "complete") init();
    else addEventListener("load", init);
  };
  s.onerror = function () { emit("error", "widget script failed to load"); };
  document.head.appendChild(s);
})();
