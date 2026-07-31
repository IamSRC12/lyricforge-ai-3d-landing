# ================================================================================
# update-code-files.ps1
# --------------------------------------------------------------------------------
# Regenerates code.txt (a systematically combined snapshot of every source file
# in this project) and appends a timestamped entry to code_log.txt.
#
# Usage:
#   .\update-code-files.ps1                        # regenerate + generic log entry
#   .\update-code-files.ps1 -Note "Added new Hero section"   # with change note
#
# IMPORTANT: Run this script ANY time a source file is created / modified /
# deleted so that code.txt always reflects the latest code.
# ================================================================================
param(
    [string]$Note = ""
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# --- Files that must never be embedded into code.txt -------------------------
# .env.local holds real secrets (DB credentials etc.) and package-lock.json /
# tsconfig.tsbuildinfo are auto-generated. node_modules and .next are build dirs.
$excludeNames = @(
    'code.txt',
    'code_log.txt',
    'code_history_log.txt',
    'update-code-files.ps1',
    'package-lock.json',
    'tsconfig.tsbuildinfo',
    '.env.local'
)

# --- 1. Root configuration files (explicit, systematic order) ---------------
$rootFiles = @(
    'package.json',
    'tsconfig.json',
    'next.config.ts',
    'next-env.d.ts',
    'eslint.config.mjs',
    'drizzle.config.json',
    'postcss.config.mjs'
)

# --- 2. All source files under src/ (recursive, sorted) ----------------------
$srcFiles = Get-ChildItem -Path (Join-Path $ProjectRoot 'src') -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object { $_.FullName } |
    Sort-Object

# --- Assemble the final ordered list -----------------------------------------
$allFiles = [System.Collections.Generic.List[string]]::new()
foreach ($f in $rootFiles) {
    $p = Join-Path $ProjectRoot $f
    if (Test-Path -LiteralPath $p) { $allFiles.Add($p) }
}
foreach ($f in $srcFiles) { $allFiles.Add($f) }

$allFiles = @($allFiles | Where-Object {
    $leaf = [System.IO.Path]::GetFileName($_)
    $leaf -notin $excludeNames
})

# --- Build code.txt ----------------------------------------------------------
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('================================================================================')
[void]$sb.AppendLine('CODE.TXT - COMBINED SOURCE SNAPSHOT')
[void]$sb.AppendLine('Project       : lyricforge-ai-3d-landing')
[void]$sb.AppendLine(("Generated     : {0:yyyy-MM-dd HH:mm:ss}" -f (Get-Date)))
[void]$sb.AppendLine("Total files   : $($allFiles.Count)")
[void]$sb.AppendLine('Regenerate    : .\update-code-files.ps1')
[void]$sb.AppendLine('Change log    : code_log.txt')
[void]$sb.AppendLine('Excluded      : node_modules, .next, .env.local (secrets),')
[void]$sb.AppendLine('                package-lock.json, tsconfig.tsbuildinfo')
[void]$sb.AppendLine('================================================================================')

foreach ($file in $allFiles) {
    $rel = $file.Substring($ProjectRoot.Length).TrimStart('\', '/')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('================================================================================')
    [void]$sb.AppendLine("FILE: $rel")
    [void]$sb.AppendLine('================================================================================')
    try {
        $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
        [void]$sb.AppendLine($content)
    } catch {
        [void]$sb.AppendLine("!! ERROR READING FILE: $($_.Exception.Message)")
    }
}

$codeTxt = $sb.ToString().TrimEnd("`r", "`n")
Set-Content -LiteralPath (Join-Path $ProjectRoot 'code.txt') -Value $codeTxt -Encoding UTF8
Write-Host "code.txt regenerated with $($allFiles.Count) files."

# --- Append entry to code_log.txt ---------------------------------------------
$logFile = Join-Path $ProjectRoot 'code_log.txt'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$logHeader = @'
================================================================================
CODE LOG - CHANGE TRACKING
Project: lyricforge-ai-3d-landing
Newest entry is always at the TOP.
================================================================================
'@

$entry = @"
================================================================================
TIMESTAMP: $timestamp
ACTION    : code.txt regenerated ($($allFiles.Count) files)
FILE      : code.txt
================================================================================
$Note
================================================================================
"@

$logDir = Split-Path -Parent $logFile
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

if (Test-Path -LiteralPath $logFile) {
    $old = Get-Content -LiteralPath $logFile -Raw -Encoding UTF8
    # Strip old header, keep only entries, then prepend new entry
    $oldLines = $old -split "`r?`n"
    # Find the separator line directly above the first TIMESTAMP line
    $entryStart = -1
    for ($i = 0; $i -lt $oldLines.Count; $i++) {
        if ($oldLines[$i] -match '^TIMESTAMP:') {
            $entryStart = $i - 1   # the separator right above the first entry
            break
        }
    }
    if ($entryStart -ge 0) {
        $oldEntries = ($oldLines[$entryStart..($oldLines.Count - 1)] -join "`r`n")
    } else {
        $oldEntries = $old
    }
    $combined = $logHeader + "`r`n" + $entry + "`r`n" + $oldEntries.TrimStart("`r", "`n")
    Set-Content -LiteralPath $logFile -Value $combined -Encoding UTF8
} else {
    $combined = $logHeader + "`r`n" + $entry
    Set-Content -LiteralPath $logFile -Value $combined -Encoding UTF8
}
Write-Host "code_log.txt updated at $timestamp"
