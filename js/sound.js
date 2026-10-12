/* Звуки без файлов: короткие синтезированные сигналы (Web Audio). Работают только после первого касания (правило браузеров).
   Если звук выключен в настройках или Web Audio недоступен — просто тишина. */
(function (root) {
  'use strict';
  var ctx = null, enabled = true, noiseBuf = null;

  function getCtx() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function unlock() { var c = getCtx(); if (c && c.state === 'suspended') c.resume(); }
  function tone(freq, start, dur, type, vol, slideTo) {
    var c = getCtx(); if (!c) return;
    var t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(start, dur, vol, freq) {
    var c = getCtx(); if (!c) return;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var t = c.currentTime + start, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq || 2500;
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
  }

  var SOUNDS = {
    deal:  function () { noise(0, 0.08, 0.12, 3200); noise(0.09, 0.08, 0.1, 2600); },
    chip:  function () { tone(1900, 0, 0.05, 'triangle', 0.07); tone(2500, 0.05, 0.06, 'triangle', 0.06); },
    check: function () { tone(180, 0, 0.07, 'sine', 0.14); },
    fold:  function () { noise(0, 0.18, 0.08, 900); },
    turn:  function () { tone(880, 0, 0.12, 'sine', 0.05); },
    win:   function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.22, 'triangle', 0.08); }); },
    lose:  function () { tone(330, 0, 0.3, 'sine', 0.07, 220); }
  };

  function play(name) {
    if (!enabled || !SOUNDS[name]) return;
    try { unlock(); SOUNDS[name](); } catch (e) {}
  }
  root.RTSound = { play: play, unlock: unlock, setEnabled: function (v) { enabled = !!v; } };
})(window);
