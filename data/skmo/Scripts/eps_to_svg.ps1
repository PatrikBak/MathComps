# The script below converts old EPS files to SVG using LaTeX, dvips, and dvisvgm.
# (why so many steps? I spent a lot of time trying it simpler and I'm glad it works...)
param(
  [Parameter(Mandatory = $true)]
  [string]$EpsPath,
  [Parameter(Mandatory = $true)]
  [string]$OutSvgPath
)

# Ensure errors stop the script and suppress progress output
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  # Get some info about the input file
  $EpsPath = (Resolve-Path -LiteralPath $EpsPath).Path
  $fileName = [System.IO.Path]::GetFileName($EpsPath)
  $extension = [System.IO.Path]::GetExtension($fileName)

  # Create unique temp working dir
  $tempDir = Join-Path $env:TEMP ("eps2svg_" + [guid]::NewGuid().Guid)
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

  # Name of the EPS file inside TEMP:
  # - If input already .eps, keep the same name but ensure lowercase
  # - Otherwise, append .eps to the original file name (including its dots), e.g., c75i.50.eps
  $tempEpsName = if ($extension -and ($extension -ieq '.eps')) { $fileName.ToLowerInvariant() } else { "$fileName.eps".ToLowerInvariant() }
  $tempEpsPath = Join-Path $tempDir $tempEpsName

  # Copy input into TEMP under the chosen EPS name
  Copy-Item -LiteralPath $EpsPath -Destination $tempEpsPath -Force

  # Write a minimal wrapper.tex inside TEMP. Use \detokenize to handle dots in filenames safely.
  $wrapperPath = Join-Path $tempDir 'wrapper.tex'
  @"
\documentclass{standalone}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{graphicx}
\begin{document}
\includegraphics{\detokenize{$tempEpsName}}
\end{document}
"@ | Set-Content -LiteralPath $wrapperPath -Encoding UTF8

  # Run the commands inside TEMP
  Push-Location $tempDir

  try {
    # The name of the intermediate files (without extension)
    $job = "render"

    # Latex will produce DVI
    & latex -interaction=nonstopmode -halt-on-error -jobname "$job" "\input{wrapper.tex}"

    # Convert the DVI to PostScript
    & dvips -Ppdf -G0 -j0 -D600 "$job.dvi" -o "$job.ps"

    # Convert the PostScript to SVG
    & dvisvgm --eps --no-fonts --exact "$job.ps" -o "$job.svg"
  }
  # Ensure we always return to the original location
  finally { Pop-Location }

  # Copy back result to requested/output path
  Copy-Item -LiteralPath (Join-Path $tempDir "render.svg") -Destination $OutSvgPath -Force

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
