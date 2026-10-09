export const BATCH_SIZE = 5
const split = text => text.split(/[\n,，、]/).map(s => s.trim()).filter(Boolean)
export function normalizeProduct(product) {
  return { ...product, sellingPoints: typeof product._sp === 'string' ? split(product._sp) : product.sellingPoints || [],
    scenarios: typeof product._sc === 'string' ? split(product._sc) : product.scenarios || [] }
}
export function createBatch() {
  return Array.from({ length: BATCH_SIZE }, (_, index) => ({
    id: `batch-${index + 1}`, product: { name: '', category: '', targetAudience: '', price: '', sellingPoints: [], scenarios: [], extra: '' },
    publication: { cartStatus: 'pending', title: '', topics: [], cartTitle: '', publishTime: '' },
    status: 'pending', error: '', script: null, painMap: null, meta: null, compliance: [],
  }))
}
export function mergePublication(current, generated = {}) {
  return { ...current,
    title: current.title || (typeof generated.title === 'string' ? Array.from(generated.title).slice(0, 20).join('') : ''),
    topics: current.topics.length ? current.topics : (Array.isArray(generated.topics) ? generated.topics.filter(t => typeof t === 'string').slice(0, 5) : []),
    cartTitle: current.cartTitle || (typeof generated.cartTitle === 'string' ? Array.from(generated.cartTitle).slice(0, 10).join('') : ''),
  }
}
// Serial requests limit API pressure. Failures are isolated; cancellation stops the queue.
export async function runBatch(items, generate, update, signal) {
  const hooks = []
  for (const item of items) {
    if (signal?.aborted) { update(item.id, { status: 'cancelled', error: '未执行：批次已取消。' }); continue }
    update(item.id, { status: 'running', error: '', script: null, painMap: null, meta: null, compliance: [] })
    try {
      const result = await generate(item, [...hooks])
      if (signal?.aborted) throw Object.assign(new Error('已取消生成。'), { name: 'AbortError' })
      if (result.script?.hook) hooks.push(result.script.hook)
      update(item.id, { ...result, status: 'success', error: '', publication: mergePublication(item.publication, result.script?.publication) })
    } catch (error) {
      update(item.id, { status: signal?.aborted || error.name === 'AbortError' ? 'cancelled' : 'error', error: error.message || String(error) })
    }
  }
}
