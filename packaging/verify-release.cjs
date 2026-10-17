const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { getCurrentFuseWire } = require('@electron/fuses')
const yaml = require('js-yaml')

async function verifyRelease(appPath) {
  const app = path.resolve(appPath)
  if (!fs.statSync(app).isDirectory() || !app.endsWith('.app'))
    throw new Error('Choose a packaged .app directory')
  const { spawnSync } = require('node:child_process')
  const description = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', app], {
    encoding: 'utf8'
  })
  if (
    description.status !== 0 ||
    !description.stderr.includes('Authority=Developer ID Application:')
  )
    throw new Error('A Developer ID Application signature is required')
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' })
  const binary = path.join(app, 'Contents/MacOS/DevDeck')
  const architectures = execFileSync('/usr/bin/lipo', ['-archs', binary], { encoding: 'utf8' })
  if (!architectures.includes('arm64') || !architectures.includes('x86_64'))
    throw new Error('Both Apple Silicon and Intel architectures are required')
  const wire = await getCurrentFuseWire(app)
  for (const [fuse, expected] of Object.entries({ 0: 48, 1: 49, 2: 48, 3: 48, 4: 49, 5: 49 })) {
    if (wire[fuse] !== expected) throw new Error(`Release fuse ${fuse} is incorrect`)
  }
  const feed = yaml.load(
    fs.readFileSync(path.join(app, 'Contents/Resources/app-update.yml'), 'utf8')
  )
  if (feed.provider !== 'github' || feed.owner !== 'anand24mishra' || feed.repo !== 'DevDeck')
    throw new Error('The release updater feed is incorrect')
  console.log(
    'Verified Developer ID signature, universal architecture, update feed and release fuses.'
  )
}
if (require.main === module)
  verifyRelease(process.argv[2] || 'release/mac-universal/DevDeck.app').catch(() => {
    console.error(
      'Release verification failed. Check the app signature, architecture, fuses and update feed before distribution.'
    )
    process.exitCode = 1
  })
module.exports = { verifyRelease }
