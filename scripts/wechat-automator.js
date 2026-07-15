const fs = require('fs')
const path = require('path')
const automator = require('miniprogram-automator')

const projectPath = path.resolve(__dirname, '..')
const defaultRoute = '/pages/home/index'
const cliCandidates = [
  process.env.WECHAT_DEVTOOLS_CLI,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli',
].filter(Boolean)

function resolveCliPath() {
  const cliPath = cliCandidates.find((candidate) => fs.existsSync(candidate))
  if (!cliPath) {
    throw new Error('未找到微信开发者工具 CLI，请设置 WECHAT_DEVTOOLS_CLI')
  }
  return cliPath
}

function normalizeRoute(value) {
  if (!value) return defaultRoute
  return value.startsWith('/') ? value : `/${value}`
}

async function main() {
  const action = process.argv[2] || 'smoke'
  const route = normalizeRoute(process.argv[3])
  const miniProgram = await automator.launch({
    cliPath: resolveCliPath(),
    projectPath,
  })

  try {
    const page = await miniProgram.reLaunch(route)
    await page.waitFor(1200)
    const currentPage = await miniProgram.currentPage()

    if (action === 'screenshot') {
      const outputPath = path.resolve(process.argv[4] || 'output/wechat-automator.png')
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      await miniProgram.screenshot({ path: outputPath })
      console.log(JSON.stringify({ ok: true, route: currentPage.path, screenshot: outputPath }))
      return
    }

    if (action !== 'smoke' && action !== 'page') {
      throw new Error(`不支持的操作: ${action}`)
    }

    console.log(JSON.stringify({ ok: true, action, route: currentPage.path }))
  } finally {
    miniProgram.disconnect()
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
