import type { PageEvent } from "~/types/page-event"

export type SemanticMatchResult = {
  pageEvent: PageEvent
  score: number
}

type Vocabulary = Map<string, number>

type TfIdfVectors = {
  vocab: Vocabulary
  docVectors: number[][]
  idf: number[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function buildVocabulary(documents: string[]): Vocabulary {
  const vocab = new Map<string, number>()
  let index = 0
  for (const doc of documents) {
    const terms = new Set(tokenize(doc))
    for (const term of terms) {
      if (!vocab.has(term)) {
        vocab.set(term, index)
        index += 1
      }
    }
  }
  return vocab
}

function computeIdf(documents: string[], vocab: Vocabulary): number[] {
  const docCount = documents.length
  const idf = new Array(vocab.size).fill(0)

  for (let i = 0; i < documents.length; i++) {
    const terms = new Set(tokenize(documents[i]))
    for (const term of terms) {
      const idx = vocab.get(term)
      if (idx !== undefined) {
        idf[idx] += 1
      }
    }
  }

  return idf.map((df) => Math.log((docCount + 1) / (df + 1)) + 1)
}

function computeTfIdfVector(text: string, vocab: Vocabulary, idf: number[]): number[] {
  const tokens = tokenize(text)
  const tf = new Array(vocab.size).fill(0)

  for (const token of tokens) {
    const idx = vocab.get(token)
    if (idx !== undefined) {
      tf[idx] += 1
    }
  }

  const maxTf = Math.max(...tf, 1)
  return tf.map((count, idx) => (count / maxTf) * idf[idx])
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1
  return vector.map((v) => v / norm)
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let sum = 0
  const len = Math.min(vecA.length, vecB.length)
  for (let i = 0; i < len; i++) {
    sum += vecA[i] * vecB[i]
  }
  return sum
}

function buildTfIdf(documents: string[]): TfIdfVectors {
  const vocab = buildVocabulary(documents)
  const idf = computeIdf(documents, vocab)
  const docVectors = documents.map((doc) => normalize(computeTfIdfVector(doc, vocab, idf)))
  return { vocab, docVectors, idf }
}

export function searchSemantic(query: string, pages: PageEvent[], minScore = 0.1): SemanticMatchResult[] {
  if (!query.trim()) return []
  if (pages.length === 0) return []

  const documents = pages.map((p) => p.title)
  const { vocab, docVectors, idf } = buildTfIdf(documents)

  const queryVector = normalize(computeTfIdfVector(query, vocab, idf))

  const results: SemanticMatchResult[] = []

  for (let i = 0; i < pages.length; i++) {
    const score = cosineSimilarity(queryVector, docVectors[i])
    if (score >= minScore) {
      results.push({ pageEvent: pages[i], score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
