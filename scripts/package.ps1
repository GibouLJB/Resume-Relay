$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'plugins/codex-resume/.codex-plugin/plugin.json') | ConvertFrom-Json
$dist = Join-Path $root 'dist'
$zip = Join-Path $dist "codex-resume-$($manifest.version)-windows.zip"
New-Item -ItemType Directory -Path $dist -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
$paths = @('README.md', 'README.en.md', 'README.zh-TW.md', 'README.ja.md', 'Resume.cmd', '.agents/plugins/marketplace.json', 'examples/codex-resume.plan.json', 'plugins/codex-resume', 'docs/images')
$temp = Join-Path $dist ('.' + [guid]::NewGuid().ToString() + '.zip')
try {
    $archive = [IO.Compression.ZipFile]::Open($temp, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($relative in $paths) {
            $entry = Get-Item -Force -LiteralPath (Join-Path $root $relative)
            $files = if ($entry.PSIsContainer) { Get-ChildItem -LiteralPath $entry.FullName -File -Recurse -Force } else { $entry }
            foreach ($file in $files) {
                $name = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $name) | Out-Null
            }
        }
    } finally {
        $archive.Dispose()
    }
    Move-Item -LiteralPath $temp -Destination $zip -Force
} finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
}
$checksum = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$zip.sha256" -Encoding ASCII -Value "$checksum  $([IO.Path]::GetFileName($zip))"
Write-Output $zip
Write-Output "$zip.sha256"
