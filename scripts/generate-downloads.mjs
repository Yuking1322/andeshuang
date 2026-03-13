import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { windowsPresetDownloads } from '../src/data/downloadPresets.js'
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
      : generateScript(preset.packageIds, {
          useChocolatey: true,
          mode: 'install'
        })

  await writeFile(filePath, content, 'utf8')
}

console.log(`Generated ${windowsPresetDownloads.length} Windows preset downloads in ${outputDir}`)
