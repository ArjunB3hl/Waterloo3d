// WebGL2 compositor: owns the GL context, textures and passes, and draws one composed frame from parameters
// computed by Effects.ts. It knows nothing about the map; all view maths arrive as uniforms.
import { createProgram, type Program, RenderTarget, Texture } from './gl';
import { BLUR_FS, BLUR_UNIFORMS, FINAL_FS, FINAL_UNIFORMS, PREP_FS, PREP_UNIFORMS } from './shaders';

export interface LifeParams {
  treeT: number;              // seconds, stepped at 8 Hz
  waterT: number;             // seconds, stepped at 6 Hz
}

export interface TiltParams {
  depth: [number, number, number];   // see COC in shaders.ts
  row: [number, number];
  coc: [number, number, number];     // (max CoC device px, band start, band end)
  blurScale: number;                 // 1 = full resolution, 0.5 = half
}

export interface ComposeParams {
  /** Sources to (re)upload this frame; null = keep the texture from the previous upload. */
  upload: { base: HTMLCanvasElement; height: HTMLCanvasElement | null; life: HTMLCanvasElement | null } | null;
  origin: [number, number];          // canvas px at the top-left device pixel
  canvasPerDev: [number, number];
  artToDev: number;
  heightDecode: [number, number];    // (1 / units_per_m, floor_m)
  life: LifeParams | null;
  tilt: TiltParams | null;
}

export class Compositor {
  private readonly gl: WebGL2RenderingContext;
  private readonly prep: Program;
  private readonly blur: Program;
  private readonly final: Program;
  private readonly vao: WebGLVertexArrayObject;
  private readonly base: Texture;
  private readonly height: Texture;
  private readonly life: Texture;
  private readonly prepTarget: RenderTarget;
  private readonly blurTarget: RenderTarget;

  /** Throws when WebGL2 is unavailable or the shaders fail to build. */
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    // aux layers hold raw bytes (packed heights, masks): no colour conversion or premultiplication on upload
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.prep = createProgram(gl, PREP_FS, PREP_UNIFORMS);
    this.blur = createProgram(gl, BLUR_FS, BLUR_UNIFORMS);
    this.final = createProgram(gl, FINAL_FS, FINAL_UNIFORMS);
    this.vao = gl.createVertexArray()!;
    this.base = new Texture(gl, gl.LINEAR);      // LINEAR for the 2x2 downsample in PREP; FINAL uses texelFetch
    this.height = new Texture(gl, gl.NEAREST);
    this.life = new Texture(gl, gl.NEAREST);
    // until the aux layers exist, sample a 1x1 "no data" texel (height invalid, no canopy / water)
    for (const t of [this.height, this.life]) {
      t.allocate(1, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    }
    this.prepTarget = new RenderTarget(gl);
    this.blurTarget = new RenderTarget(gl);
    // the final pass always binds the blur target; keep it complete even before tilt-shift first runs
    this.blurTarget.resize(1, 1);
  }

  get contextLost(): boolean { return this.gl.isContextLost(); }

  draw(p: ComposeParams): void {
    const gl = this.gl;
    const W = this.canvas.width, H = this.canvas.height;
    if (p.upload) {
      this.base.upload(p.upload.base);
      if (p.upload.height) this.height.upload(p.upload.height);
      if (p.upload.life) this.life.upload(p.upload.life);
    }
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    const tilt = p.tilt;
    let cocLimit = 1;
    if (tilt) {
      const bw = Math.max(1, Math.round(W * tilt.blurScale)), bh = Math.max(1, Math.round(H * tilt.blurScale));
      this.prepTarget.resize(bw, bh);
      this.blurTarget.resize(bw, bh);
      cocLimit = Math.max(1, tilt.coc[0] * tilt.blurScale);

      this.prepTarget.bind();
      gl.useProgram(this.prep.handle);
      this.bindTextures(this.prep, { uBase: this.base, uHeight: this.height });
      this.setCocUniforms(this.prep, p, W, H, tilt);
      gl.uniform2f(this.prep.u.uTargetSize, bw, bh);
      gl.uniform1f(this.prep.u.uBlurScale, tilt.blurScale);
      gl.uniform1f(this.prep.u.uCocLimit, cocLimit);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      this.blurTarget.bind();
      gl.useProgram(this.blur.handle);
      this.bindTextures(this.blur, { uPrep: this.prepTarget.tex });
      gl.uniform1f(this.blur.u.uCocLimit, cocLimit);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    const f = this.final;
    gl.useProgram(f.handle);
    this.bindTextures(f, { uBase: this.base, uHeight: this.height, uLife: this.life, uBlur: this.blurTarget.tex });
    gl.uniform1i(f.u.uLifeOn, p.life ? 1 : 0);
    gl.uniform1i(f.u.uTiltOn, tilt ? 1 : 0);
    gl.uniform2f(f.u.uOrigin, p.origin[0], p.origin[1]);
    gl.uniform2f(f.u.uCanvasPerDev, p.canvasPerDev[0], p.canvasPerDev[1]);
    gl.uniform1f(f.u.uArtToDev, p.artToDev);
    gl.uniform2f(f.u.uTime, p.life?.treeT ?? 0, p.life?.waterT ?? 0);
    this.setCocUniforms(f, p, W, H, tilt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [this.base, this.height, this.life]) t.dispose();
    this.prepTarget.dispose();
    this.blurTarget.dispose();
    for (const prog of [this.prep, this.blur, this.final]) gl.deleteProgram(prog.handle);
    gl.deleteVertexArray(this.vao);
  }

  private bindTextures(prog: Program, textures: Record<string, Texture>): void {
    const gl = this.gl;
    let unit = 0;
    for (const [name, tex] of Object.entries(textures)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex.handle);
      gl.uniform1i(prog.u[name], unit++);
    }
  }

  private setCocUniforms(prog: Program, p: ComposeParams, W: number, H: number, tilt: TiltParams | null): void {
    const gl = this.gl;
    gl.uniform2f(prog.u.uSize, W, H);
    gl.uniform2f(prog.u.uHeightDec, p.heightDecode[0], p.heightDecode[1]);
    // with tilt-shift off the CoC is identically zero (max radius 0)
    const t = tilt ?? { depth: [0, 0, 0], row: [0, 0], coc: [0, 1, 2] };
    gl.uniform3f(prog.u.uDepth, t.depth[0], t.depth[1], t.depth[2]);
    gl.uniform2f(prog.u.uRow, t.row[0], t.row[1]);
    gl.uniform3f(prog.u.uCoc, t.coc[0], t.coc[1], t.coc[2]);
  }
}
