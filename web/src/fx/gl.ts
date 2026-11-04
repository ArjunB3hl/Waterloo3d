// Minimal WebGL2 helpers for the effects compositor: program compilation, textures and render targets.

export interface Program {
  readonly handle: WebGLProgram;
  /** Uniform locations by name (missing / optimised-out uniforms map to null and are ignored by WebGL). */
  readonly u: Record<string, WebGLUniformLocation | null>;
}

/** Every pass draws one full-screen triangle generated from gl_VertexID (no vertex buffers). */
const FULLSCREEN_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`shader compile failed: ${log}`);
  }
  return s;
}

export function createProgram(gl: WebGL2RenderingContext, fragmentSrc: string, uniforms: readonly string[]): Program {
  const vs = compile(gl, gl.VERTEX_SHADER, FULLSCREEN_VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const handle = gl.createProgram()!;
  gl.attachShader(handle, vs);
  gl.attachShader(handle, fs);
  gl.linkProgram(handle);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(handle)}`);
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniforms) u[name] = gl.getUniformLocation(handle, name);
  return { handle, u };
}

/** A 2D RGBA8 texture whose size follows whatever is uploaded or allocated into it. */
export class Texture {
  readonly handle: WebGLTexture;
  width = 0;
  height = 0;

  constructor(private readonly gl: WebGL2RenderingContext, filter: number) {
    this.handle = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Copy a canvas into the texture; reuses the existing storage when the size is unchanged. */
  upload(src: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    if (src.width === this.width && src.height === this.height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      this.width = src.width; this.height = src.height;
    }
  }

  /** Allocate uninitialised storage (render targets). No-op when the size is unchanged. */
  allocate(w: number, h: number): boolean {
    if (w === this.width && h === this.height) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.width = w; this.height = h;
    return true;
  }

  dispose(): void { this.gl.deleteTexture(this.handle); this.width = this.height = 0; }
}

/** An offscreen colour target backed by a Texture. Rows are stored top-down (row 0 = top of the screen). */
export class RenderTarget {
  readonly tex: Texture;
  private readonly fbo: WebGLFramebuffer;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.tex = new Texture(gl, gl.LINEAR);
    this.fbo = gl.createFramebuffer()!;
  }

  resize(w: number, h: number): void {
    if (!this.tex.allocate(w, h)) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex.handle, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.tex.width, this.tex.height);
  }

  dispose(): void { this.gl.deleteFramebuffer(this.fbo); this.tex.dispose(); }
}
