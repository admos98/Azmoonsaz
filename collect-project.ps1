# collect-project.ps1
# Creates project-tree.txt and project-dump.txt for AI/code review.
# Run from the project root.

$OutputFile = "project-dump.txt"
$TreeFile = "project-tree.txt"

$ExcludeDirs = @(
    "node_modules",
    "dist",
    "build",
    "out",
    ".git",
    ".cache",
    ".next",
    ".nuxt",
    ".vite",
    ".vercel",
    "coverage",
    ".turbo",
    ".parcel-cache"
)

$ExcludeFiles = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "project-dump.txt"
)

$IncludeExtensions = @(
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
    ".scss",
    ".sass",
    ".html",
    ".md",
    ".svg"
)

$IncludeExactFiles = @(
    ".env.example",
    ".gitignore",
    "package.json",
    "metadata.json",
    "vite.config.ts",
    "vite.config.js",
    "tailwind.config.js",
    "tailwind.config.ts",
    "postcss.config.js",
    "postcss.config.cjs",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "eslint.config.js",
    "index.html",
    "README.md"
)

function Test-IsExcludedPath {
    param (
        [string]$FullPath
    )

    foreach ($dir in $ExcludeDirs) {
        if ($FullPath -like "*\$dir\*") {
            return $true
        }
    }

    return $false
}

Write-Host "Creating project tree..." -ForegroundColor Cyan
cmd /c tree /F /A > $TreeFile

Write-Host "Creating project dump..." -ForegroundColor Cyan

if (Test-Path $OutputFile) {
    Remove-Item $OutputFile -Force
}

"PROJECT DUMP" | Out-File -FilePath $OutputFile -Encoding utf8
"Generated at: $(Get-Date)" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"PROJECT TREE" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"" | Out-File -FilePath $OutputFile -Append -Encoding utf8

Get-Content $TreeFile -Raw | Out-File -FilePath $OutputFile -Append -Encoding utf8

"" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"FILES" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
"" | Out-File -FilePath $OutputFile -Append -Encoding utf8

$Files = Get-ChildItem -Path . -Recurse -File |
    Where-Object {
        $fullPath = $_.FullName
        $name = $_.Name
        $ext = $_.Extension.ToLower()

        if (Test-IsExcludedPath $fullPath) {
            return $false
        }

        if ($ExcludeFiles -contains $name) {
            return $false
        }

        if ($IncludeExactFiles -contains $name) {
            return $true
        }

        if ($IncludeExtensions -contains $ext) {
            return $true
        }

        return $false
    } |
    Sort-Object FullName

foreach ($file in $Files) {
    $relativePath = Resolve-Path -Path $file.FullName -Relative

    "" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "FILE: $relativePath" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "============================================================" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    "" | Out-File -FilePath $OutputFile -Append -Encoding utf8

    try {
        Get-Content -Path $file.FullName -Raw -Encoding UTF8 | Out-File -FilePath $OutputFile -Append -Encoding utf8
    }
    catch {
        "[Could not read file as UTF-8 text]" | Out-File -FilePath $OutputFile -Append -Encoding utf8
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Created: $TreeFile" -ForegroundColor Green
Write-Host "Created: $OutputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Please upload project-tree.txt and project-dump.txt here." -ForegroundColor Yellow
