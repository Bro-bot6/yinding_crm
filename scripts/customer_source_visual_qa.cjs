// Browser assertions run only against the disposable localhost QA database.
const { chromium } = require('C:/Users/niko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const path = require('node:path')

const expectedSources = ['抖音', '视频号', '服务号', '朋友介绍']

async function login(page) {
  await page.goto('http://127.0.0.1:8001/#/customers')
  if (await page.locator('[name=username]').count()) {
    await page.locator('[name=username]').fill('qa-personal')
    await page.locator('[name=password]').fill('Local-QA-only-2026')
    await page.locator('button[type=submit]').click()
    await page.waitForURL(url => !url.pathname.includes('login'))
  }
  await page.goto('http://127.0.0.1:8001/#/customers')
  await page.locator('.customer-record').first().waitFor()
}

async function filterSourceLabels(page) {
  const sourceField = page.locator('.filter-panel .custom-select-field').filter({ hasText: '客户来源' })
  await sourceField.locator('.custom-select-trigger').click()
  const labels = await page.locator('.floating-menu-layer button span').allInnerTexts()
  await page.keyboard.press('Escape')
  return labels
}

async function createSourceLabels(page) {
  await page.getByRole('button', { name: /新建客资/ }).click()
  const sourceField = page.locator('.create-customer-drawer .custom-select-field').filter({ hasText: '客资来源' })
  await sourceField.locator('.custom-select-trigger').click()
  const labels = await page.locator('.floating-menu-layer .themed-select-options button span > b').allInnerTexts()
  await page.keyboard.press('Escape')
  await page.locator('.create-customer-drawer').getByRole('button', { name: '关闭' }).click()
  return labels.map(label => label.trim()).filter(Boolean)
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1520, height: 920 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await login(page)

    const statuses = await page.locator('.customer-record .record-wechat-status').allInnerTexts()
    assert.ok(statuses.length >= 3)
    for (const expected of ['已添加', '未添加', '已添加未通过']) assert.ok(statuses.includes(expected))
    assert.deepEqual(await filterSourceLabels(page), ['全部来源', ...expectedSources])
    assert.deepEqual(await createSourceLabels(page), expectedSources)

    const firstLine = await page.locator('.customer-record').first().locator('.record-contact-line').evaluate(element => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      phoneBottom: element.querySelector('.record-copy-phone').getBoundingClientRect().bottom,
      statusBottom: element.querySelector('.record-wechat-status').getBoundingClientRect().bottom,
    }))
    assert.equal(firstLine.scrollWidth <= firstLine.clientWidth, true)
    assert.ok(Math.abs(firstLine.phoneBottom - firstLine.statusBottom) < 4)

    await page.screenshot({ path: path.resolve('private-qa-personal/customer-source-wechat-1520.png'), fullPage: true })
    for (const width of [760, 390]) {
      await page.setViewportSize({ width, height: 920 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.equal(await page.locator('.record-wechat-status').first().isVisible(), true)
      await page.screenshot({ path: path.resolve(`private-qa-personal/customer-source-wechat-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1520, height: 920 })
    for (const theme of ['极简商务', '深色数据', '清爽企业']) {
      await page.getByTitle(theme, { exact: true }).click()
      await page.waitForTimeout(350)
      await page.screenshot({ path: path.resolve(`private-qa-personal/customer-source-${theme}.png`), fullPage: false })
    }
    assert.deepEqual(errors, [])
    console.log('PASS: WeChat status is visible and aligned; all source selectors contain exactly four sources; desktop, narrow layouts, and three themes have no page errors.')
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
