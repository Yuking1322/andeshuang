const EMPTY_RESULT = {
  installed: false,
  version: '',
  source: '',
  displayName: ''
}

export function generateDetectionScript() {
  return String.raw`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

function New-Result {
  param(
    [bool]$Installed,
    [string]$Version = '',
    [string]$Source = '',
    [string]$DisplayName = ''
  )

  return [ordered]@{
    installed = $Installed
    version = $Version
    source = $Source
    displayName = $DisplayName
  }
}

function Get-CommandInstall {
  param(
    [string]$CommandName,
    [string[]]$VersionArgs = @('--version')
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if (-not $command) {
    return New-Result $false
  }

  $version = ''
  try {
    if ($VersionArgs.Count -gt 0) {
      $version = (& $CommandName @VersionArgs 2>&1 | Select-Object -First 1)
    }
  } catch {
    $version = ''
  }

  return New-Result $true ([string]$version).Trim() ([string]$command.Source).Trim() ([string]$command.Name).Trim()
}

function Get-RegistryInstall {
  param(
    [string[]]$Patterns
  )

  $registryPaths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )

  foreach ($path in $registryPaths) {
    $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
    foreach ($pattern in $Patterns) {
      $match = $items |
        Where-Object { [string]$_.DisplayName -like "*$pattern*" } |
        Select-Object -First 1

      if ($match) {
        return New-Result $true ([string]$match.DisplayVersion).Trim() 'registry' ([string]$match.DisplayName).Trim()
      }
    }
  }

  return New-Result $false
}

function Get-ServiceInstall {
  param(
    [string[]]$Patterns
  )

  $service = Get-Service -Name $Patterns -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $service) {
    $service = Get-Service -DisplayName $Patterns -ErrorAction SilentlyContinue | Select-Object -First 1
  }

  if ($service) {
    return New-Result $true ([string]$service.Status).Trim() 'service' ([string]$service.DisplayName).Trim()
  }

  return New-Result $false
}

function Merge-Result {
  param(
    $Primary,
    $Fallback
  )

  if ($Primary.installed) {
    return $Primary
  }

  return $Fallback
}

function Test-PythonModule {
  param(
    [string]$ModuleName
  )

  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    return New-Result $false
  }

  $pythonSnippet = @"
import importlib.util
import sys

name = sys.argv[1]
spec = importlib.util.find_spec(name)
if spec is None:
    print('NOT_INSTALLED')
else:
    module = __import__(name)
    print(getattr(module, '__version__', 'installed'))
"@

  try {
    $result = (& python -c $pythonSnippet $ModuleName 2>&1 | Select-Object -First 1)
    if ([string]$result -eq 'NOT_INSTALLED') {
      return New-Result $false '' 'python-module' $ModuleName
    }

    return New-Result $true ([string]$result).Trim() 'python-module' $ModuleName
  } catch {
    return New-Result $false '' 'python-module' $ModuleName
  }
}

$results = [ordered]@{}

$results.nodejs = Get-CommandInstall 'node'
$results.git = Get-CommandInstall 'git'
$results.vscode = Merge-Result (Get-CommandInstall 'code') (Get-RegistryInstall @('Visual Studio Code'))
$results.pnpm = Get-CommandInstall 'pnpm'
$results.uv = Get-CommandInstall 'uv'
$results.python = Get-CommandInstall 'python'
$results.jupyterlab = Merge-Result (Get-CommandInstall 'jupyter-lab' @('--version')) (Get-CommandInstall 'jupyter' @('lab', '--version'))
$results.openjdk = Merge-Result (Get-CommandInstall 'java' @('-version')) (Get-RegistryInstall @('OpenJDK', 'Temurin', 'JDK'))
$results.intellijidea = Get-RegistryInstall @('IntelliJ IDEA Community Edition', 'IntelliJ IDEA')
$results.maven = Get-CommandInstall 'mvn' @('-v')
$results.gradle = Get-CommandInstall 'gradle' @('--version')
$results.mysql = Merge-Result (Get-CommandInstall 'mysql') (Get-RegistryInstall @('MySQL'))
$results.redis = Merge-Result (Get-CommandInstall 'redis-server') (Merge-Result (Get-ServiceInstall @('Redis*')) (Get-RegistryInstall @('Redis')))
$results.postgresql = Merge-Result (Get-CommandInstall 'psql') (Merge-Result (Get-ServiceInstall @('postgresql*')) (Get-RegistryInstall @('PostgreSQL')))
$results.dbeaver = Merge-Result (Get-CommandInstall 'dbeaver') (Get-RegistryInstall @('DBeaver'))
$results.powershell7 = Get-CommandInstall 'pwsh' @('-v')
$results.windowsterminal = Merge-Result (Get-CommandInstall 'wt' @('-v')) (Get-RegistryInstall @('Windows Terminal'))
$results.dotnet = Get-CommandInstall 'dotnet' @('--version')
$results.go = Get-CommandInstall 'go' @('version')
$results.rust = Get-CommandInstall 'rustc' @('--version')
$results.ollama = Merge-Result (Get-CommandInstall 'ollama') (Get-RegistryInstall @('Ollama'))
$results.dockerdesktop = Merge-Result (Get-CommandInstall 'docker') (Get-RegistryInstall @('Docker Desktop'))

$condaResult = Get-CommandInstall 'conda'
$results.miniconda = New-Result $false
if ($condaResult.installed) {
  $condaBase = ''
  try {
    $condaBase = (& conda info --base 2>&1 | Select-Object -First 1).ToString().ToLowerInvariant()
  } catch {
    $condaBase = ''
  }

  if ($condaBase -like '*mini*') {
    $results.miniconda = $condaResult
  }
}

$results.pytorch = Test-PythonModule 'torch'
$results.cuda = Merge-Result (Get-CommandInstall 'nvcc' @('--version')) (Get-RegistryInstall @('NVIDIA CUDA'))

$payload = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  machineName = $env:COMPUTERNAME
  results = $results
}

$outputPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'andeshuang-detection.json'

try {
  $jsonText = $payload | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($outputPath, $jsonText, [System.Text.UTF8Encoding]::new($false))
  Write-Host ''
  Write-Host '检测完成，结果文件已保存到桌面：' -ForegroundColor Green
  Write-Host $outputPath -ForegroundColor Cyan
  Write-Host ''
  Write-Host '把这个 JSON 文件导回安的爽页面，就能自动跳过已安装的软件。' -ForegroundColor Yellow
  exit 0
} catch {
  Write-Host ''
  Write-Host '保存文件失败。' -ForegroundColor Red
  Write-Host "错误信息：$($_.Exception.Message)" -ForegroundColor Red
  Write-Host ''
  Write-Host '请尝试以管理员身份运行，或检查桌面是否有写入权限。' -ForegroundColor Yellow
  exit 1
}`
}

export function generateDetectionLauncher() {
  const script = generateDetectionScript()
  const encodedScript = toUtf8BomBase64(script)
  const chunks = chunkString(encodedScript, 900)
  const envAssignments = chunks
    .map((chunk, index) => `set "PS_CHUNK_${index + 1}=${chunk}"`)
    .join('\r\n')
  const envJoin = chunks
    .map((_, index) => `$env:PS_CHUNK_${index + 1}`)
    .join(' + ')

  return `@echo off
setlocal
chcp 65001 >nul
title andeshuang health check
set "PS1_PATH=%TEMP%\\andeshuang-health-check.ps1"
${envAssignments}
echo.
echo =====================================
echo        andeshuang health check
echo =====================================
echo.
echo Starting environment detection...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$encoded = ${envJoin}; $bytes = [Convert]::FromBase64String($encoded); [System.IO.File]::WriteAllBytes($env:PS1_PATH, $bytes)"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_PATH%"
set "ps_exit=%errorlevel%"
del "%PS1_PATH%" >nul 2>&1
echo.
if not "%ps_exit%"=="0" (
  echo Detection failed. Press any key to close.
  pause >nul
  endlocal
  exit /b %ps_exit%
)
echo Detection complete. Press any key to close.
pause >nul
endlocal
`
}

export function normalizeDetectionPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('检测结果格式不正确')
  }

  if (!payload.results || typeof payload.results !== 'object' || Array.isArray(payload.results)) {
    throw new Error('缺少 results 字段')
  }

  const normalizedResults = Object.entries(payload.results).reduce((resultMap, [id, value]) => {
    resultMap[id] = {
      installed: Boolean(value?.installed),
      version: typeof value?.version === 'string' ? value.version.trim() : '',
      source: typeof value?.source === 'string' ? value.source.trim() : '',
      displayName: typeof value?.displayName === 'string' ? value.displayName.trim() : ''
    }
    return resultMap
  }, {})

  return {
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : '',
    machineName: typeof payload.machineName === 'string' ? payload.machineName : '',
    results: normalizedResults
  }
}

export function createEmptyDetectionSnapshot() {
  return {
    generatedAt: '',
    machineName: '',
    results: {}
  }
}

export function getDetectionEntry(snapshot, packageId) {
  return snapshot?.results?.[packageId] ?? EMPTY_RESULT
}

function toUtf8BomBase64(input) {
  const encoder = new TextEncoder()
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const body = encoder.encode(input)
  const combined = new Uint8Array(bom.length + body.length)
  combined.set(bom)
  combined.set(body, bom.length)
  let binary = ''
  combined.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function chunkString(value, size) {
  const chunks = []
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size))
  }
  return chunks
}
