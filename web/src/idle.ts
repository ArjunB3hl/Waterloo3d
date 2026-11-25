// One queue for main-thread work that takes a few milliseconds and can wait a moment: decoding a height tile, unpacking a
// collision chunk. Such work arrives in groups (a ring of tiles, the chunks around a boundary), and run as it lands,
// several pieces can fall inside one frame and drop it. Each caller instead waits for its turn, one per idle period.

const WAIT_MS = 80;   // longest a turn waits for an idle period before it runs anyway

let last: Promise<void> = Promise.resolve();

/** Resolves in an idle period (or after 80 ms), for one caller at a time, in the order asked. */
export function idleTurn(): Promise<void> {
  const idle = () => new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: WAIT_MS });
    else setTimeout(resolve, 16);          // no idle callbacks (Safari): about one turn per frame
  });
  return (last = last.then(idle));
}
