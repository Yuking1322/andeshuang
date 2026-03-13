import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '..')
const port = process.env.CF_DEV_PORT || '8788'
const children = []
let downloadTimer = null
let shuttingDown = false

const isWindows = os.platform() === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const viteCommand = isWindows
  ? path.join(projectRoot, 'node_modules', '.bin', 'vite.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'vite')
const wranglerCommand = isWindows
  ? path.join(projectRoot, 'node_modules', '.bin', 'wrangler.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'wrangler')

await runCommand(npmCommand, ['run', 'build:downloads'], 'downloads:init')

const viteWatch = spawnCommand(viteCommand, ['build', '--watch'], 'vite:watch')
const wranglerDev = spawnCommand(wranglerCommand, ['pages', 'dev', 'dist', '--port', port], 'wrangler')

children.push(viteWatch, wranglerDev)

const watchTargets = [
  path.join(projectRoot, 'src', 'data'),
  path.join(projectRoot, 'src', 'utils'),
  path.join(projectRoot, 'scripts')
]

const watchers = watchTargets
  .filter((target) => fs.existsSync(target))
  .map((target) =>
    fs.watch(
      target,
      { recursive: true },
      () => {
        if (downloadTimer) clearTimeout(downloadTimer)
        downloadTimer = setTimeout(() => {
          runCommand(npmCommand, ['run', 'build:downloads'], 'downloads:watch').catch((error) => {
            console.error(`[downloads:watch] ${error.message}`)
          })
        }, 250)
      }
    )
  )

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`Process exited unexpectedly with code ${code}`)
      shutdown()
    }
  })
}

function spawnCommand(command, args, label) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows
  })

  child.stdout.on('data', (chunk) => process.stdout.write(prefixLines(chunk, label)))
  child.stderr.on('data', (chunk) => process.stderr.write(prefixLines(chunk, label)))

  return child
}

function prefixLines(chunk, label) {
  return chunk
    .toString()
    .split(/\r?\n/)
    .filter((line, index, array) => line.length > 0 || index < array.length - 1)
    .map((line) => `[${label}] ${line}\n`)
    .join('')
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: isWindows
    })

    child.stdout.on('data', (chunk) => process.stdout.write(prefixLines(chunk, label)))
    child.stderr.on('data', (chunk) => process.stderr.write(prefixLines(chunk, label)))
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true

  watchers.forEach((watcher) => watcher.close())
  children.forEach((child) => {
    if (!child.killed) child.kill()
  })

  setTimeout(() => process.exit(0), 150)
}
