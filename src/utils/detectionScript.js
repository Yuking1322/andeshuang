const EMPTY_RESULT = {
  installed: false,
  version: '',
  source: '',
  displayName: ''
}

export function generateDetectionScript() {
  return String.raw`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

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
$results.yarn = Get-CommandInstall 'yarn'
$results.pnpm = Get-CommandInstall 'pnpm'
$results.python = Get-CommandInstall 'python'
$results.openjdk = Merge-Result (Get-CommandInstall 'java' @('-version')) (Get-RegistryInstall @('OpenJDK', 'Temurin', 'JDK'))
$results.mysql = Merge-Result (Get-CommandInstall 'mysql') (Get-RegistryInstall @('MySQL'))
$results.redis = Merge-Result (Get-CommandInstall 'redis-server') (Merge-Result (Get-ServiceInstall @('Redis*')) (Get-RegistryInstall @('Redis')))
$results.postgresql = Merge-Result (Get-CommandInstall 'psql') (Merge-Result (Get-ServiceInstall @('postgresql*')) (Get-RegistryInstall @('PostgreSQL')))
$results.mongodb = Merge-Result (Get-CommandInstall 'mongod') (Merge-Result (Get-ServiceInstall @('MongoDB*')) (Get-RegistryInstall @('MongoDB')))

$condaResult = Get-CommandInstall 'conda'
$results.anaconda = New-Result $false
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
  } elseif ($condaBase -like '*ana*') {
    $results.anaconda = $condaResult
  } else {
    $results.anaconda = $condaResult
  }
}

$results.pytorch = Test-PythonModule 'torch'
$results.tensorflow = Test-PythonModule 'tensorflow'
$results.cuda = Merge-Result (Get-CommandInstall 'nvcc' @('--version')) (Get-RegistryInstall @('NVIDIA CUDA'))

$payload = [ordered]@{
  generatedAt = (Get-Date).ToString('s')
  machineName = $env:COMPUTERNAME
  results = $results
}

$outputPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'andeshuang-detection.json'
$payload | ConvertTo-Json -Depth 6 | Set-Content -Path $outputPath -Encoding UTF8

Write-Host ''
Write-Host '检测完成，结果文件已保存到桌面：' -ForegroundColor Green
Write-Host $outputPath -ForegroundColor Cyan
Write-Host ''
Write-Host '把这个 JSON 文件导回安的爽页面，就能自动跳过已安装的软件。' -ForegroundColor Yellow
Pause`
}

export function generateDetectionLauncher() {
  const script = generateDetectionScript()
  const encodedCommand = toUtf16LeBase64(script)

  return `@echo off
chcp 65001 >nul
title 安的爽 - 一键环境体检
echo.
echo =====================================
echo        安的爽 - 一键环境体检
echo =====================================
echo.
echo 正在检测当前电脑已安装的开发环境，请稍候...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}
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

function toUtf16LeBase64(input) {
  const bytes = new Uint8Array(input.length * 2)

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    bytes[index * 2] = code & 255
    bytes[index * 2 + 1] = code >> 8
  }

  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  if (typeof btoa === 'function') {
    return btoa(binary)
  }

  return Buffer.from(binary, 'binary').toString('base64')
}
