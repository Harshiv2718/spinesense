// Spoken coaching (speechSynthesis, offline) and optional voice commands (SpeechRecognition).

// When the coach last finished speaking, so the listener can ignore its own voice through the speakers.
let lastSpeechEnd = -Infinity;
const markEnd = () => { lastSpeechEnd = performance.now(); };
const coachTalking = () => globalThis.speechSynthesis?.speaking || performance.now() - lastSpeechEnd < 1500;

export class Voice {
  constructor(enabled = true) {
    this.enabled = enabled && 'speechSynthesis' in window;
    this.last = new Map();
    this.voice = null;
    if (this.enabled) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => /en[-_](GB|US|IN|AU)/i.test(v.lang) && /natural|neural|google|aria|jenny|sonia/i.test(v.name))
          ?? voices.find((v) => v.lang?.startsWith('en')) ?? null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  /**
   * priority: interrupts whatever is being said (safety messages).
   * Otherwise skipped if something is already being said, and the same key is rate-limited.
   */
  say(text, { priority = false, key = text, gap = 7000 } = {}) {
    if (!this.enabled || !text) return;
    const now = performance.now();
    if (!priority) {
      if (now - (this.last.get(key) ?? -Infinity) < gap) return;
      if (speechSynthesis.speaking) return;
    } else {
      speechSynthesis.cancel();
    }
    this.last.set(key, now);
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 1.02;
    u.onend = u.onerror = markEnd;
    speechSynthesis.speak(u);
  }

  /** Rep counts and hold countdowns are time-critical: they cut off anything older. */
  count(text) {
    if (!this.enabled) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.rate = 1.1;
    u.onend = u.onerror = markEnd;
    speechSynthesis.speak(u);
  }

  stop() {
    if (this.enabled) speechSynthesis.cancel();
  }
}

const NUMBERS = { zero: 0, one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** Listens for "ow", "ouch", "pain", "stop", "pause", "continue" and numbers 0–10. */
export class Listener {
  static get supported() {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  constructor(onCommand, onState) {
    this.onCommand = onCommand;
    this.onState = onState;
    this.active = false;
    this.lastFire = new Map();
  }

  start() {
    if (!Listener.supported || this.active) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      // Laptop speakers feed the coach's own words back into the mic ("say continue", "from zero to ten"),
      // so while it talks only "stop" and "ow" count: hearing those by mistake is harmless.
      const echo = coachTalking();
      for (let i = e.resultIndex; i < e.results.length; i++) this.parse(e.results[i][0].transcript.toLowerCase(), { echo });
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.active = false;
        this.onState?.('denied');
      }
    };
    rec.onend = () => {
      if (this.active) {
        try {
          rec.start();
        } catch {
          /* already restarting */
        }
      }
    };
    this.rec = rec;
    this.active = true;
    try {
      rec.start();
      this.onState?.('listening');
    } catch (e) {
      console.warn(e);
    }
  }

  fire(kind, value) {
    const now = performance.now();
    const key = kind === 'number' ? `n${value}` : kind;
    if (now - (this.lastFire.get(key) ?? -Infinity) < 1500) return;
    this.lastFire.set(key, now);
    this.onCommand(kind, value);
  }

  parse(text, { echo = false } = {}) {
    if (/\b(stop|pause|enough|wait)\b/.test(text)) this.fire('stop');
    if (/\b(o+w+|ouch|pain|painful|hurts?|hurting|argh+|ahh+)\b/.test(text)) this.fire('pain');
    if (echo) return;
    if (/\b(continue|resume|carry on|ready|go on)\b/.test(text)) this.fire('resume');
    const m = text.match(/\b(10|[0-9]|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    if (m) this.fire('number', /\d/.test(m[1]) ? Number(m[1]) : NUMBERS[m[1]]);
  }

  stop() {
    this.active = false;
    try {
      this.rec?.stop();
    } catch {
      /* ignore */
    }
    this.onState?.('off');
  }
}
