import { h, icon } from '../map/widgets/dom';

const PREFERENCE_KEY = 'arjunPortfolio.music.v1';

/** Start playback from an entry-button gesture so browsers can allow audible music. */
export function createPortfolioMusic(ui: HTMLElement): { start: () => void } {
  const audio = h('audio', { class: 'portfolio-music', preload: 'none', 'aria-hidden': 'true' });
  audio.src = 'audio/slow-laps.mp3';
  audio.loop = true;
  audio.volume = 0.22;
  let enabled = true;
  let started = false;
  try { enabled = localStorage.getItem(PREFERENCE_KEY) !== 'off'; } catch { /* storage unavailable */ }

  // Space and Enter on the focused button toggle it: the goose's flight keys leave keys aimed at a button alone
  const button = h('button', { type: 'button', class: 'icon-btn music-toggle' });
  const sync = () => {
    const playing = !audio.paused && !audio.error;
    const label = playing ? 'Mute music' : 'Unmute music';
    button.replaceChildren(icon(playing ? 'volume' : 'muted'));
    button.setAttribute('aria-label', label);
    button.title = `${label} · Slow Laps · ElevenLabs`;
    button.setAttribute('aria-pressed', String(playing));
  };
  const play = () => {
    if (!started || !enabled || document.hidden) return;
    // A blocked or interrupted play must never stop the game or leave an unhandled rejection.
    void audio.play().catch(sync);
  };
  button.addEventListener('click', () => {
    started = true;
    enabled = audio.paused;
    if (enabled) play();
    else audio.pause();
    try { localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off'); } catch { /* storage unavailable */ }
    sync();
  });
  for (const event of ['playing', 'pause', 'error']) audio.addEventListener(event, sync);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause();
    else play();
  });
  // In the right-hand control column with share, settings and about: a fixed corner of its own put it under the map
  // attribution footer on phones and on top of the touch flight pad's turn-left button in landscape.
  const group = ui.querySelector('.controls .btn-group:last-child');
  ui.append(audio);
  if (group) group.prepend(button); else ui.append(button);
  sync();
  return { start: () => { started = true; play(); } };
}
