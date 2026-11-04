# Measuring Tiny Waterloo on your MacBook

The numbers in `docs/perf_container.json` come from a headless Chromium using SwiftShader, a software GPU, in a
4-core Linux container. They show whether the app works and how memory behaves. They do not show real frame rates.
These steps measure the MacBook Air M3 itself. Part A is automatic and takes about 3 minutes. Part B is a 1-minute
check by hand.

## Before you start

- Plug in the charger, close other heavy apps and browser tabs, and leave the display at its default resolution.
- You need the repository and Node.js 20 or newer: `node -v`.
- Run once from the repository root: `npm install`.

## Part A: automatic benchmark (Chrome, then Safari if you like)

1. In a terminal, from the repository root, run:

   ```
   npm run perf:device
   ```

   This builds the production site into `web/dist` and serves it at `http://127.0.0.1:4180/`. Leave it running.

2. Open **Google Chrome** and go to `http://127.0.0.1:4180/perf_device.html`. Make the window full-screen
   (green button, or Ctrl+Cmd+F), so the map is about 1440x900 CSS px at devicePixelRatio 2.
3. Leave "Seconds per pass" at 60 and press **Run benchmark**. Don't touch the mouse or switch windows until the
   status line says "Done". Chrome slows background tabs, which would spoil the numbers. The page runs two passes:
   - **Effects on** (tree sway, water shimmer and tilt-shift blur)
   - **Effects off**

   Each pass loads the app fresh, waits for the tiles, then flies the camera on a set route from campus through
   Laurier, Waterloo Park, Silver Lake and Uptown and back, zooming in and out at each stop.
4. Press **Copy results** and paste the JSON back into the conversation. All of it is useful. These fields matter
   most:
   - `gpu` and `devicePixelRatio` confirm that the real GPU was used ("Apple M3", not "SwiftShader") at Retina scale.
   - `runs[].load.firstBitmapDecodedMs` and `allVisibleTilesLoadedMs` are the load times.
   - `runs[].panning.fps`, `panning.frameMs.p95` and `percentFramesOver25ms` measure how smooth panning is. On a
     60 Hz display, smooth means fps near 60 and p95 near 16.7 ms.
   - `runs[].zooming`: the same numbers while zooming.
   - `runs[].appDrawP95Ms` is the CPU time the map spends drawing tiles each frame.
   - `runs[].memory` holds the decoded tile cache in MB (peak and budget), the height tiles and the JS heap.
5. (Optional) Repeat steps 2 to 4 in **Safari**. Safari does not report the JS heap, and it may hide the GPU name.

The camera in Part A is driven by script through the map's own API, not by the mouse, so it measures rendering but
not input handling. Part B covers input.

## Part B: real-mouse check with the performance HUD (1 minute)

1. With the server from Part A still running, open `http://127.0.0.1:4180/?perf=1` in Chrome, full-screen. A
   small performance panel appears. You can also turn it on later in Settings under "Performance HUD".
2. Wait until the campus has loaded. Then drag the map steadily back and forth with the trackpad for about
   10 seconds, from campus toward Waterloo Park. Read the panel **while you are still dragging**:
   - `fps`: frames drawn in the last second. It reads 0 when the map is idle, because frames are only drawn when
     something changes.
   - `frame p95`: the 95th-percentile frame interval in ms.
   - `draw p95`: the CPU draw time in ms.
3. Pinch or scroll to zoom in on Silver Lake and out again for about 5 seconds, and read the same three values.
4. Open Settings and switch off **Life on the map** and **Tilt-shift focus**. Repeat step 2.
5. Wait about 5 seconds with the map at rest, then copy the tile-cache values (`bitmaps`, `MB` against the budget)
   and `heap`.
6. Click **Fly as a goose**. Fly around campus for about 10 seconds (A/D turn, W/S climb, Shift boost) and read
   `fps` and `frame p95` again. Press L to land.

Send back a short list, for example:

```
B2 drag, effects on:  fps 60, frame p95 17.1, draw p95 1.2
B3 zoom, effects on:  fps .., frame p95 .., draw p95 ..
B4 drag, effects off: fps .., frame p95 .., draw p95 ..
B5 at rest: bitmaps .., MB ../.., heap .. MB
B6 goose flight: fps .., frame p95 ..
Anything that looked wrong (stutter, blurry tiles that never sharpen, flicker, fan noise):
```

## Troubleshooting

- **The benchmark stops with "app did not finish loading tiles"**: check that the terminal from step A1 is still
  running, then reload the page.
- **`gpu` says SwiftShader or "no WebGL2"**: hardware acceleration is off. Turn on Chrome Settings > System > "Use
  graphics acceleration when available", restart Chrome and run again.
- Your own map settings are saved before the benchmark and restored after it.
