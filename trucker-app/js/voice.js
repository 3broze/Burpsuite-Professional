/* RouteRig voice: turn-by-turn speech + voice commands (like Google Maps) */
(function (global) {
  'use strict';
  const RR = (global.RR = global.RR || {});

  const voice = {
    enabled: true,          // voice guidance on/off
    alertsEnabled: true,    // speak weigh/clearance/fuel alerts
    listening: false,
    rec: null,
    lastText: null,

    /* ---------- speech output ---------- */
    speak(text) {
      if (!this.enabled || !text) return;
      try {
        const w = global;
        if (!w.speechSynthesis) return;
        w.speechSynthesis.cancel();
        const U = w.SpeechSynthesisUtterance;
        const u = U ? new U(text) : { text: text };
        u.rate = 1.02;
        u.pitch = 1;
        let voices = [];
        try { voices = w.speechSynthesis.getVoices ? w.speechSynthesis.getVoices() : []; } catch (e) { /* noop */ }
        const en = voices.find(v => /en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
        if (en && u.voice !== undefined) u.voice = en;
        w.speechSynthesis.speak(u);
        this.lastText = text;
      } catch (e) { /* speech unavailable — silent */ }
    },

    stop() {
      try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { /* noop */ }
    },

    speakAlert(title) {
      if (this.alertsEnabled && title) this.speak(title);
    },

    /* ---------- voice input (commands) ---------- */
    init() {
      const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      if (!SR) return false;
      try {
        this.rec = new SR();
      } catch (e) { return false; }
      this.rec.lang = 'en-US';
      this.rec.interimResults = false;
      this.rec.maxAlternatives = 1;
      this.rec.onresult = (e) => {
        let txt = '';
        try { txt = e.results[0][0].transcript; } catch (err) { /* noop */ }
        if (txt) this.handleCommand(txt);
      };
      this.rec.onend = () => {
        this.listening = false;
        if (RR.hooks && RR.hooks.voiceState) RR.hooks.voiceState(false);
      };
      this.rec.onerror = (e) => {
        this.listening = false;
        if (RR.hooks && RR.hooks.voiceState) RR.hooks.voiceState(false);
        if (e && e.error && e.error !== 'aborted' && e.error !== 'not-allowed' && RR.toast) {
          RR.toast('Voice input error', 'warn', e.error);
        }
      };
      return true;
    },

    toggleListen() {
      if (!this.rec) {
        if (RR.toast) RR.toast('Voice input not supported in this browser', 'info', 'Try Chrome or Edge, over HTTPS.');
        return false;
      }
      if (this.listening) {
        try { this.rec.stop(); } catch (e) { /* noop */ }
        return false;
      }
      try {
        this.rec.start();
        this.listening = true;
        if (RR.hooks && RR.hooks.voiceState) RR.hooks.voiceState(true);
        if (RR.toast) RR.toast('Listening…', 'info', 'Try: "navigate to Dallas" · "demo drive" · "stop" · "mute"');
        return true;
      } catch (e) {
        if (RR.toast) RR.toast('Microphone unavailable', 'warn', (e && e.message) || 'Check mic permissions.');
        return false;
      }
    },

    handleCommand(raw) {
      const t = String(raw || '').toLowerCase().replace(/[.!?,]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return;
      if (RR.hooks && RR.hooks.voiceCommand) RR.hooks.voiceCommand(t);
    }
  };

  RR.voice = voice;
  if (typeof module !== 'undefined' && module.exports) module.exports = voice;
})(typeof window !== 'undefined' ? window : globalThis);
