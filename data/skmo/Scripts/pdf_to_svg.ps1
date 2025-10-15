# The script below converts PDF files to SVG using Inkscape. 
param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,
  [Parameter(Mandatory = $true)]
  [string]$OutSvgPath
)

# Ensure errors stop the script and suppress progress output
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  # Resolve inputs to absolute paths (no manual quoting needed)
  $PdfPath = (Resolve-Path -LiteralPath $PdfPath).Path
  $originalName = [System.IO.Path]::GetFileName($PdfPath)
  $extension = [System.IO.Path]::GetExtension($originalName)

  # Ensure output directory exists
  $outDir = [System.IO.Path]::GetDirectoryName($OutSvgPath)
  if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }

  # Create unique temp working dir
  $tempDir = Join-Path $env:TEMP ("pdf2svg_" + [guid]::NewGuid().Guid)
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

  # Ensure the input PDF has a .pdf extension inside TEMP (and ensure lowercase)
  $tempPdfName = if ($extension -and ($extension -ieq '.pdf')) { $originalName.ToLowerInvariant() } else { "$originalName.pdf".ToLowerInvariant() }
  $tempPdfPath = Join-Path $tempDir $tempPdfName

  # Copy input into TEMP
  Copy-Item -LiteralPath $PdfPath -Destination $tempPdfPath -Force

  # We will run Inkscape inside TEMP
  Push-Location $tempDir

  try {
    # Prepare Inkscape command
    $inkscape = (Get-Command inkscape -ErrorAction Stop).Source
    
    # Prepare arguments
    $inkscapeArgs = @(
      $tempPdfPath
      '--pdf-poppler'
      '--export-type=svg'
      '--export-plain-svg'
      '--export-filename=render.svg'
    )

    # Run Inkscape to convert PDF to SVG
    & $inkscape @inkscapeArgs
  }
  finally {
    # Ensure we always return from TEMP
    Pop-Location
  }

  # Copy back result
  Copy-Item -LiteralPath (Join-Path $tempDir 'render.svg') -Destination $OutSvgPath -Force

  # Clean temp on success
  Remove-Item -Recurse -Force $tempDir

  # Success
  exit 0
}
finally {
  # Clean up TEMP in any case
  if ($tempDir -and (Test-Path -LiteralPath $tempDir)) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}
catch {
  # Failure
  exit 1
}
