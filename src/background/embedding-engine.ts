import { env, pipeline } from "@xenova/transformers"

// ================================
// AGGRESSIVE MV3 FIX
// ================================

// Completely disable all advanced backends
env.backends.onnx.wasm.numThreads = 1
env.backends.onnx.wasm.simd = false
env.backends.onnx.wasm.proxy = false

// Disable WebGPU/WebNN (JSEP providers)
if (env.backends.onnx.webgpu) {
  env.backends.onnx.webgpu = false as any
}
if (env.backends.onnx.webnn) {
  env.backends.onnx.webnn = false as any
}

// Force local models only after it is downloaded once
env.allowRemoteModels = true
env.allowLocalModels = true
env.useBrowserCache = true

// Set WASM paths to assets directory
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL("assets/")

// Override ONNX module loader to prevent JSEP loading
const originalImport = (globalThis as any).import
if (originalImport) {
  (globalThis as any).import = async (path: string) => {
    if (path.includes('.jsep.mjs')) {
      console.warn('Blocked JSEP module load:', path)
      throw new Error('JSEP not supported in MV3')
    }
    return originalImport(path)
  }
}

// ================================

const MODEL_ID = "Xenova/all-MiniLM-L6-v2"

type SimpleEmbeddingPipeline = (...args: any[]) => Promise<any>

let embeddingPipeline: SimpleEmbeddingPipeline | null = null
let loadingPromise: Promise<SimpleEmbeddingPipeline> | null = null

export function isModelReady(): boolean {
  return embeddingPipeline !== null
}

export async function initializeModel(): Promise<SimpleEmbeddingPipeline | null> {
  if (embeddingPipeline) return embeddingPipeline
  if (loadingPromise) return loadingPromise

  try {
    console.log('🔄 Initializing model with WASM-only backend...')
    
    // Force execution provider to CPU/WASM only
    loadingPromise = pipeline(
      "feature-extraction",
      MODEL_ID,
      {
        device: "wasm",
        quantized: true,
        // Explicitly set execution providers
        executionProviders: ["wasm"],
      } as any
    ) as Promise<SimpleEmbeddingPipeline>

    embeddingPipeline = await loadingPromise
    console.log(`✅ Model loaded: ${MODEL_ID}`)
    return embeddingPipeline
  } catch (error) {
    console.error("❌ Failed to load embedding model:", error)
    embeddingPipeline = null
    loadingPromise = null
    return null
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text) return null

  const model = await initializeModel()
  if (!model) return null

  try {
    const output: any = await model(text, {
      pooling: "mean",
      normalize: true,
    })

    if (output?.data) {
      return Array.from(output.data as Iterable<number>)
    }

    if (Array.isArray(output?.[0])) {
      return output[0].map(Number)
    }

    return null
  } catch (error) {
    console.error(`Embedding generation failed:`, error)
    return null
  }
}