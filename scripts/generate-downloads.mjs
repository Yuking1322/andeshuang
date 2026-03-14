import { mkdir, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { windowsPresetDownloads } from '../src/data/downloadPresets.js'
import { resolveDependencies } from '../src/data/environments.js'
import { generateDetectionLauncher } from '../src/utils/detectionScript.js'
import { generateScript } from '../src/utils/scriptGenerator.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '..')
const outputDir = path.join(projectRoot, 'public', 'downloads', 'windows')

await mkdir(outputDir, { recursive: true })

for (const preset of windowsPresetDownloads) {
  const filePath = path.join(outputDir, preset.fileName)
  const content =
    preset.kind === 'detection'
      ? generateDetectionLauncher()
      : generateScript(resolveDependencies(preset.packageIds), {
          useChocolatey: true,
          mode: 'install',
          sourceLabel: 'Windows 预置包'
        })

  // 添加 UTF-8 BOM，确保 Windows CMD 正确解析中文
  const bom = Buffer.from([0xef, 0xbb, 0xbf])
  const body = Buffer.from(content, 'utf8')
  const combined = Buffer.concat([bom, body])

  await writeFile(filePath, combined)
}

console.log(`Generated ${windowsPresetDownloads.length} Windows preset downloads in ${outputDir}`)
