import { h } from '../map/widgets/dom';

const PREFERENCE_KEY = 'arjunPortfolio.music.v1';

/** Start playback from an entry-button gesture so browsers can allow audible music. */
export function createPortfolioMusic(ui: HTMLElement): { start: () => void } {
  const audio = h('audio', { class: 'portfolio-music', preload: 'none', 'aria-hidden': 'true' });
  audio.src = 'audio/campus-daydream.mp3';
  audio.loop = true;
  audio.volume = 0.22;
  let enabled = true;
  let started = false;
  try { enabled = localStorage.getItem(PREFERENCE_KEY) !== 'off'; } catch { /* storage unavailable */ }

  const button = h('button', {
    type: 'button', class: 'music-toggle panel-chrome',
    title: 'Campus Daydream · original instrumental generated with ElevenLabs',
    onkeydown: (event: Event) => event.stopPropagation(),
  });
  const sync = () => {
    const playing = !audio.paused && !audio.error;
    button.textContent = playing ? '♫ Music on' : '♫ Music off';
    button.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
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
  ui.append(audio, button);
  sync();
  return { start: () => { started = true; play(); } };
}
