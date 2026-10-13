// Reads QR codes and barcodes with the Barcode Detection API, or (Safari,
// Firefox) the barcode-detector ponyfill, which runs ZXing as WebAssembly.
// Loaded only when the scanner opens, and the .wasm file is served by
// Squirrel itself, so nothing is fetched from a CDN and codes never leave the
// device.

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

const FORMATS = [
  'qr_code',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'itf',
  'data_matrix',
  'pdf417',
  'aztec',
] as const

export interface CodeReader {
  /** The text of the first code found in the image or video frame, or null. */
  read: (source: ImageBitmapSource) => Promise<string | null>
}

export async function createReader(): Promise<CodeReader> {
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  const detector = new BarcodeDetector({ formats: [...FORMATS] })
  return {
    read: async (source) => {
      const codes = await detector.detect(source)
      return codes.find((c) => c.rawValue)?.rawValue ?? null
    },
  }
}
