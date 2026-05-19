# The script below batch-renders Asymptote .asy files to PDF and SVG sitting next to each .asy.
# It is meant for the handout-figure workflow: author a .asy file (typically importing _common.asy)
# and let this script produce both a vector PDF and a plain SVG without ever opening a viewer.
#
# Per .asy file the pipeline is:
#   1. Run asy with -noView to render the .asy to a PDF next to the source. asy is run with
#      -cd <dir> so `import _common;` and other relative imports resolve next to the source file.
#   2. Patch the PDF's non-deterministic metadata (timestamps and IDs that the bundled Ghostscript
#      stamps with wall-clock values) so re-rendering an unchanged .asy produces a byte-identical
#      PDF and stops creating spurious git diffs.
#   3. Run asy a second time with -f svg to emit the SVG directly via the bundled
#      dvisvgm. This preserves the zero-length entries in dash-dot patterns like
#      [6, 3, 0, 3]; a generic PDF->SVG conversion flattens them into a plain [6, 6].
param(
  # One or more directories, .asy files, or PowerShell wildcards (e.g. 'angles-*.asy'). Default
  # is the folder this script lives in, which matches the typical handout-figures layout.
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$Path = @(Split-Path -Parent $MyInvocation.MyCommand.Definition),

  # Path to the Asymptote executable.
  [string]$AsyExe = 'C:\Program Files\Asymptote\asy.exe'
)

# Ensure errors stop the script and suppress progress output
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Validate the Asymptote executable up front so we fail fast with a clear message
if (-not (Test-Path -LiteralPath $AsyExe)) {
  Write-Error "Asymptote executable not found at $AsyExe"
  exit 1
}

# Pipeline for one .asy file: asy PDF + asy SVG. Both outputs are written next to the
# input as <stem>.pdf / <stem>.svg.
function Convert-OneAsy {
  param(
    [Parameter(Mandatory = $true)][string]$AsyPath
  )

  # Determine output paths
  $stem     = [System.IO.Path]::GetFileNameWithoutExtension($AsyPath)
  $dir      = [System.IO.Path]::GetDirectoryName($AsyPath)
  $finalPdf = Join-Path $dir "$stem.pdf"
  $finalSvg = Join-Path $dir "$stem.svg"

  # 1. Render the .asy to PDF. -noView suppresses asy's auto-opening of the system PDF viewer.
  #    -f pdf forces PDF output (asy otherwise picks based on settings.eps / settings.outformat).
  #    -o <stem> sets the output filename stem (asy appends the format extension).
  #    -cd <dir> changes asy's working directory so `import _common;` resolves next to the file.
  if (Test-Path -LiteralPath $finalPdf) { Remove-Item -LiteralPath $finalPdf -Force }
  $asyArgs = @('-noView', '-f', 'pdf', '-o', $stem, '-cd', $dir, $AsyPath)
  $proc = Start-Process -FilePath $AsyExe -ArgumentList $asyArgs -Wait -PassThru -NoNewWindow
  if ($proc.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $finalPdf)) {
    throw "asy failed (exit $($proc.ExitCode))"
  }

  # 2. Replace the non-deterministic metadata that asy's bundled Ghostscript stamps with wall-clock
  #    values (/CreationDate, /ModDate, /ID in the trailer plus a second copy of the dates and a
  #    DocumentID UUID inside the XMP stream). With those derived from the .asy source instead,
  #    re-rendering an unchanged .asy yields a byte-identical PDF and stops producing spurious git
  #    diffs. The Windows builds of GS we have access to (asy's bundled 10.x and MiKTeX's 9.25)
  #    ignore SOURCE_DATE_EPOCH and the -dOmit* flags, so we patch the bytes ourselves.
  $mtimeUtc = (Get-Item -LiteralPath $AsyPath).LastWriteTimeUtc
  # Date timestamps for the two formats Ghostscript emits: PDF date string in the trailer /Info,
  # ISO 8601 in the XMP stream. UTC normalised so the field length doesn't depend on local TZ.
  $pdfDate = "D:{0:yyyyMMddHHmmss}+00'00'" -f $mtimeUtc
  $xmpDate = "{0:yyyy-MM-ddTHH:mm:ss}+00:00" -f $mtimeUtc
  # Identifiers: SHA-256 of the .asy content gives 64 hex chars. First 32 supply the /ID halves
  # (PDF spec calls for 16-byte values); next 32 fill the DocumentID UUID positions.
  $hash = (Get-FileHash -LiteralPath $AsyPath -Algorithm SHA256).Hash
  $idHex = $hash.Substring(0, 32)
  $uuidHex = $hash.Substring(32, 32)
  $uuid = '{0}-{1}-{2}-{3}-{4}' -f $uuidHex.Substring(0, 8), $uuidHex.Substring(8, 4), $uuidHex.Substring(12, 4), $uuidHex.Substring(16, 4), $uuidHex.Substring(20, 12)
  # Read the PDF as Latin1 so each byte round-trips losslessly through a string (PDFs are mostly
  # ASCII outside of stream contents, and our regexes never match inside binary streams).
  $pdfBytes = [System.IO.File]::ReadAllBytes($finalPdf)
  $pdfText = [System.Text.Encoding]::Latin1.GetString($pdfBytes)
  # Trailer /Info dict.
  $pdfText = [regex]::Replace($pdfText, "/CreationDate\(D:\d{14}[+\-]\d{2}'\d{2}'\)", "/CreationDate($pdfDate)")
  $pdfText = [regex]::Replace($pdfText, "/ModDate\(D:\d{14}[+\-]\d{2}'\d{2}'\)", "/ModDate($pdfDate)")
  $pdfText = [regex]::Replace($pdfText, "/ID \[<[0-9A-Fa-f]{32}><[0-9A-Fa-f]{32}>\]", "/ID [<$idHex><$idHex>]")
  # XMP metadata stream (uncompressed in asy's output).
  $pdfText = [regex]::Replace($pdfText, "<xmp:CreateDate>[^<]+</xmp:CreateDate>", "<xmp:CreateDate>$xmpDate</xmp:CreateDate>")
  $pdfText = [regex]::Replace($pdfText, "<xmp:ModifyDate>[^<]+</xmp:ModifyDate>", "<xmp:ModifyDate>$xmpDate</xmp:ModifyDate>")
  $pdfText = [regex]::Replace($pdfText, "xapMM:DocumentID='uuid:[0-9a-fA-F-]+'", "xapMM:DocumentID='uuid:$uuid'")
  # Every replacement above is the same length as the value it replaced, so the PDF's xref byte
  # offsets stay valid without rebuilding the table.
  [System.IO.File]::WriteAllBytes($finalPdf, [System.Text.Encoding]::Latin1.GetBytes($pdfText))

  # 3. Render SVG directly from the .asy via asy's built-in dvisvgm pipeline.
  if (Test-Path -LiteralPath $finalSvg) { Remove-Item -LiteralPath $finalSvg -Force }
  $asySvgArgs = @('-noView', '-f', 'svg', '-o', $stem, '-cd', $dir, $AsyPath)
  $proc = Start-Process -FilePath $AsyExe -ArgumentList $asySvgArgs -Wait -PassThru -NoNewWindow
  if ($proc.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $finalSvg)) {
    throw "asy SVG render failed (exit $($proc.ExitCode))"
  }
}

# Resolve each entry in $Path into .asy files: a directory expands to *.asy in it, a single
# file is used as-is, anything else is treated as a glob (Get-ChildItem handles wildcards).
$asyFiles = @()
foreach ($p in $Path) {
  if (-not (Test-Path -LiteralPath $p -PathType Container) -and $p -notmatch '\.asy$') {
    $p = $p + '.asy'
  }
  if (Test-Path -LiteralPath $p -PathType Container) {
    $asyFiles += Get-ChildItem -LiteralPath $p -Filter '*.asy' -File
  } elseif (Test-Path -LiteralPath $p -PathType Leaf) {
    $asyFiles += @(Get-Item -LiteralPath $p)
  } else {
    $asyFiles += Get-ChildItem -Path $p -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Extension -ieq '.asy' }
  }
}

# Skip shared modules: '_' prefix (handout-wide, e.g. _common.asy) and '-shared' suffix
# (per-figure-family, e.g. angles-square-equilateral-shared.asy — sorts next to its siblings).
$asyFiles = @($asyFiles | Where-Object {
    -not $_.Name.StartsWith('_') -and -not $_.BaseName.EndsWith('-shared')
})

if ($asyFiles.Count -eq 0) {
  Write-Error "No .asy files found for path: $Path"
  exit 1
}

# Process each .asy, accumulate per-file status so one failure doesn't stop the batch
$total = $asyFiles.Count
Write-Host "Processing $total file$(if ($total -ne 1) { 's' })..." -ForegroundColor Cyan
$ok = 0; $fail = 0; $i = 0
foreach ($asyFile in $asyFiles) {
  $i++
  $prefix = "[$i/$total]"
  try {
    Convert-OneAsy -AsyPath $asyFile.FullName
    Write-Host "$prefix [OK]   $($asyFile.Name)" -ForegroundColor Green
    $ok++
  }
  catch {
    Write-Host "$prefix [FAIL] $($asyFile.Name): $_" -ForegroundColor Yellow
    $fail++
  }
}

# Final report
Write-Host ""; Write-Host "Done. Success: $ok, Failed: $fail" -ForegroundColor Cyan; Write-Host ""

if ($fail -gt 0) { exit 1 } else { exit 0 }
