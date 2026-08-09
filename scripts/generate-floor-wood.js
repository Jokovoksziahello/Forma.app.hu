import fs from 'fs'
import zlib from 'zlib'

const width = 512
const height = 512
const bytesPerRow = width * 4 + 1
const buffer = Buffer.alloc(bytesPerRow * height)
for (let y = 0; y < height; y += 1) {
  const rowOffset = y * bytesPerRow
  buffer[rowOffset] = 0
  for (let x = 0; x < width; x += 1) {
    const base = 170 + Math.sin((x + y * 0.7) / 18) * 15 + Math.cos((x - y * 0.4) / 24) * 10
    const noise = (Math.random() - 0.5) * 8
    const r = Math.round(Math.max(96, Math.min(240, base + noise + 20)))
    const g = Math.round(Math.max(70, Math.min(180, base + noise - 10)))
    const b = Math.round(Math.max(45, Math.min(120, base + noise - 38)))
    const pixelOffset = rowOffset + 1 + x * 4
    buffer[pixelOffset] = r
    buffer[pixelOffset + 1] = g
    buffer[pixelOffset + 2] = b
    buffer[pixelOffset + 3] = 255
  }
}

function makeCrcTable() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
}

const crcTable = makeCrcTable()
function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

function writeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lengthBuf = Buffer.alloc(4)
  const chunkBuf = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  lengthBuf.writeUInt32BE(data.length, 0)
  crcBuf.writeUInt32BE(crc32(chunkBuf), 0)
  return Buffer.concat([lengthBuf, chunkBuf, crcBuf])
}

const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0
const idat = zlib.deflateSync(buffer)
const png = Buffer.concat([
  pngHeader,
  writeChunk('IHDR', ihdr),
  writeChunk('IDAT', idat),
  writeChunk('IEND', Buffer.alloc(0)),
])
fs.writeFileSync('public/floor-wood.png', png)
console.log('Created public/floor-wood.png', png.length)
