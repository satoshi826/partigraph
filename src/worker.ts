import {Core, Vao, Program, Renderer, State, calcAspectRatioVec} from 'glaku'
export default {}

type ImageData = {width: number, height: number, data: Array<number>}
const imageState = new State<ImageData | null>(null)
const mouseState = new State({x: 0, y: 0})

const main = async(canvas: HTMLCanvasElement) => {
  const core = new Core({canvas})

  const image = await new Promise<ImageData>((resolve) => {
    const off = imageState.on((img) => {
      if (img) {
        resolve(img)
        off()
      }
    })
  })

  const w = image.width
  const h = image.height
  const array = image.data

  const ar = calcAspectRatioVec(w, h)
  const pixels: { r: number; g: number; b: number; a: number; brightness: number, index: number }[] = []

  for (let i = 0; i < array.length; i += 4) {
    const r = array[i]
    const g = array[i + 1]
    const b = array[i + 2]
    const a = array[i + 3]
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b
    const index = (i + 4) / 4
    pixels.push({r, g, b, a, brightness, index})
  }
  pixels.sort((a, b) => a.brightness - b.brightness)

  const sortedArray = []

  for (let i = 0; i < pixels.length; i++) {
    const idx = i * 4
    sortedArray[idx] = pixels[i].r
    sortedArray[idx + 1] = pixels[i].g
    sortedArray[idx + 2] = pixels[i].b
    sortedArray[idx + 3] = pixels[i].index
  }

  const pixelVAO = new Vao(core, {
    attributes: {
      a_position: [...Array(w * h).keys()].flatMap((_, i) => {
        const x = 2 * ((i % w) / w) - 1
        const y = 2 * (Math.ceil(i / w) / h) - 1
        return [x, y]
      }),
      a_color: sortedArray
    }
  })

  const program = new Program(core, {
    attributeTypes: {
      a_position: 'vec2',
      a_color   : 'vec4'
    },
    uniformTypes: {
      u_aspectRatio: 'vec2',
      u_phase      : 'float'
    },
    primitive: 'POINTS',
    vert     : /* glsl */ `
    out vec4 v_color;
        void main() {
          v_color = a_color;
          float i = a_color.a;
          float x = 2.0 * mod(i, ${w}.0) / ${w}.0 - 1.0;
          float y = -(2.0 * ceil(i / ${w}.0) / ${h}.0 - 1.0);
          vec2 past_pos = vec2(x, y);
          vec2 ar = u_aspectRatio / max(u_aspectRatio.x, u_aspectRatio.y);
          vec2 pos = mix(past_pos, a_position, u_phase);
          gl_Position = vec4(pos * ar, 1.0, 1.0);
          gl_PointSize = 1.0;
        }`,
    frag: /* glsl */ `
        in vec4 v_color;
        out vec4 o_color;
        void main() {
          o_color = vec4(v_color.rgb / 255.0, 1.0);
        }`
  })

  program.setUniform({u_aspectRatio: ar})

  const renderer = new Renderer(core, {backgroundColor: [0, 0, 0, 1.0]})

  mouseState.on(({y}) => {
    program.setUniform({u_phase: Math.min(Math.max(1 * (y + 0.5), 0), 1)})
    renderer.render(pixelVAO, program)
  })
}

onmessage = async({data}) => {
  const {canvas, image, mouse} = data
  if (mouse) mouseState.set(mouse)
  if (image) imageState.set(image)
  if (canvas) main(canvas)
}