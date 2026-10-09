import test from 'node:test'
import assert from 'node:assert/strict'
import { createBatch, normalizeProduct, runBatch, mergePublication } from '../src/lib/batch.js'
import { generateProduct } from '../src/lib/generate.js'
import { toBatchMarkdown, toBatchJSON, toMarkdown } from '../src/lib/export.js'

test('five independent products and publishing fields', () => {
  const items = createBatch()
  assert.equal(items.length, 5)
  items[0].publication.topics.push('#家居')
  assert.deepEqual(items[1].publication.topics, [])
  assert.deepEqual(normalizeProduct({ sellingPoints: ['旧数据'], scenarios: ['场景'] }).sellingPoints, ['旧数据'])
  assert.deepEqual(normalizeProduct({ _sp: '甲\n乙，丙', _sc: '' }).sellingPoints, ['甲', '乙', '丙'])
})
test('serial generation isolates failure and avoids previous hooks', async () => {
  const items = createBatch()
  const calls = []
  await runBatch(items, async (item, hooks) => {
    calls.push([item.id, hooks])
    if (item.id === 'batch-2') throw new Error('限流')
    return { script: { hook: item.id, shots: [{ index: 1 }] } }
  }, (id, patch) => Object.assign(items.find(i => i.id === id), patch))
  assert.equal(items[1].status, 'error')
  assert.equal(items[4].status, 'success')
  assert.deepEqual(calls[2][1], ['batch-1'])
  assert.equal(calls.length, 5)
})
test('cancellation stops subsequent calls and preserves completed result', async () => {
  const items = createBatch(), controller = new AbortController()
  let calls = 0
  await runBatch(items, async () => {
    calls++
    if (calls === 2) { controller.abort(); throw Object.assign(new Error('取消'), { name: 'AbortError' }) }
    return { script: { shots: [{}] } }
  }, (id, patch) => Object.assign(items.find(i => i.id === id), patch), controller.signal)
  assert.equal(calls, 2)
  assert.equal(items[0].status, 'success')
  assert.ok(items.slice(1).every(i => i.status === 'cancelled'))
})
test('retry updates only targeted row', async () => {
  const items = createBatch()
  items[0].status = 'success'
  const original = structuredClone(items[0])
  await runBatch([items[1]], async () => ({ script: { shots: [{}] } }), (id, patch) => Object.assign(items.find(i => i.id === id), patch))
  assert.deepEqual(items[0], original)
  assert.equal(items[1].status, 'success')
})
test('publication drafts never overwrite manual values or invent time/status', () => {
  const manual = { cartStatus: 'off', title: '自定', topics: ['#自定'], cartTitle: '', publishTime: '2026-10-10T09:00' }
  const result = mergePublication(manual, { title: '模型', topics: ['#模型'], cartTitle: '标题'.repeat(10), publishTime: 'invented', cartStatus: 'on' })
  assert.equal(result.title, '自定')
  assert.deepEqual(result.topics, ['#自定'])
  assert.equal(result.cartTitle.length, 10)
  assert.equal(result.publishTime, manual.publishTime)
  assert.equal(result.cartStatus, 'off')
})
test('batch exports preserve all rows, status, publishing fields and existing markdown', () => {
  const items = createBatch()
  Object.assign(items[0], { status: 'success', script: { logline: '剧情', shots: [] }, meta: { duration: 15 } })
  items[0].publication = { cartStatus: 'on', title: '测试标题', topics: ['#测试'], cartTitle: '商品', publishTime: '2026-10-10T09:00' }
  items[1].status = 'error'; items[1].error = '失败原因'
  const json = JSON.parse(toBatchJSON(items)), md = toBatchMarkdown(items)
  assert.deepEqual(json.items, items)
  assert.equal(json.timezone, 'Asia/Shanghai')
  for (const value of ['测试标题', '#测试', '商品', '2026-10-10T09:00', '失败原因', '第 5 条']) assert.ok(md.includes(value))
  assert.ok(md.includes(toMarkdown(items[0].script, items[0].meta)))
})
test('shared generator uses original two-stage prompts and 15-second structure', async () => {
  const calls = []
  const result = await generateProduct({ p: { name: '抽纸', sellingPoints: ['柔软'] }, settings: {}, styleId: 'reversal', toneId: 'grounded', durationKey: 15, platformId: 'douyin', temperature: .8,
    publication: { cartStatus: 'off' }, completion: async request => {
      calls.push(request)
      return JSON.stringify(calls.length === 1 ? { pain_points: [{}] } : { shots: [{ index: 1 }], publication: { title: '测试' } })
    } })
  assert.equal(calls.length, 2)
  assert.ok(calls[1].messages.some(m => m.content.includes('15')))
  assert.ok(calls[1].messages.at(-1).content.includes('不要引导购物车'))
  assert.equal(result.script.publication.title, '测试')
})
test('malformed model output fails instead of reporting success', async () => {
  await assert.rejects(generateProduct({ p: {}, settings: {}, temperature: .8, completion: async () => 'not json' }), /格式无效/)
})
