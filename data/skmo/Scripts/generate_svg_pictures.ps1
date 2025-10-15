# The script below goes through the SKMO archive images, which are either EPS or PDF, and converts
# them to SVG using eps_to_svg.ps1 and pdf_to_svg.ps1. The converted SVG files are placed into
# a separate ImagesRoot directory, preserving the year-based structure. 
# 
# NOTE: These images are not committed so running this on a new repo would not do 
#       anything. Only the results of this conversion are committed + manually added
#       pictures. The reason for not committing them is because they aren't inteded 
#       to be changed cause there's no easy way to edit them, it's better to just
#       recrate them and put them among manual pictures
#

# Resolve absolute paths
$ArchiveRoot = (Resolve-Path -LiteralPath '../Archive/').Path
$ImagesRoot = (Resolve-Path -LiteralPath '../Images/').Path

# Converter scripts live next to this script
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$epsConvPath = Join-Path $here 'eps_to_svg.ps1'
$pdfConvPath = Join-Path $here 'pdf_to_svg.ps1'

# Function to invoke a converter script (EPS or PDF) with wait for it to finish
# parameters:
# - ScriptPath: full path to the converter script
# - Args: array of arguments to pass to the script
function Invoke-Converter {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string[]]$Args
  )
  # Get the path to the PowerShell executable
  $psExe = (Get-Command powershell).Source
  
  # Quote both the script path and all arguments that contain spaces
  $quotedArgs = $Args | ForEach-Object { 
    # Quote each arg if contains spaces or quotes
    if ($_ -match '\s|"') { 
      "`"$($_ -replace '"', '""')`"" 
    }
    # Otherwise, leave as is
    else { 
      $_ 
    } 
  }
  
  # Build the full argument string for PowerShell
  $argumentString = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" $($quotedArgs -join ' ')"
  
  # Start the poweshell process and wait for it to finish
  $process = Start-Process -FilePath $psExe -ArgumentList $argumentString -WindowStyle Hidden -PassThru -Wait
  
  # Return the exit code of the converter script
  return $process.ExitCode
}

# Counters of how many images succeeded, failed, skipped
$ok = 0; $fail = 0; $skip = 0

# Find two-digit year directories directly under the ArchiveRoot
$yearDirs = Get-ChildItem -Path $ArchiveRoot -Directory | Where-Object { $_.Name -match '^[0-9]{2}$' }

# Process each year directory
foreach ($yearDir in $yearDirs) {
  $year = $yearDir.Name

  # Look for 'obr' subdirectory with images
  $obr = Join-Path $yearDir.FullName 'obr'

  # Skip if 'obr' does not exist
  if (-not (Test-Path $obr)) { continue }

  # Ensure destination year directory exists
  $destinationDir = Join-Path $ImagesRoot $year
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null

  # Get all potential image files in 'obr'
  $files = Get-ChildItem -LiteralPath $obr -File

  # Process each potential image file
  foreach ($file in $files) {
    $baseName = $file.Name
    $fullPath = $file.FullName
    $extension = [System.IO.Path]::GetExtension($baseName)
    $extensionLower = if ($extension) { $extension.ToLowerInvariant().TrimStart('.') } else { '' }

    # Literal extensions will be removed 
    if ($extensionLower -eq 'pdf' -or $extensionLower -eq 'eps') {
      $outSvg = Join-Path $destinationDir (([System.IO.Path]::GetFileNameWithoutExtension($baseName)).ToLowerInvariant() + '.svg')
    }
    # If these extensions are not present, just append .svg (it might look weird but if you look at 
    # those images, they really have random extensions such as .1, .2...crazy stuff)
    else {
      $outSvg = Join-Path $destinationDir ($baseName.ToLowerInvariant() + '.svg')
    }

    # Handle based on extension
    switch ($extensionLower) {
      'pdf' {
        # For pdf, we will invoke our pdf-to-svg script
        $code = Invoke-Converter -ScriptPath $pdfConvPath -Args @('-PdfPath', $fullPath, '-OutSvgPath', $outSvg)

        # If conversion succeeded and output SVG was created, count as OK
        if ($code -eq 0 -and (Test-Path -LiteralPath $outSvg)) {
          Write-Host "[OK]   $year/$baseName" -ForegroundColor Green
          $ok++
        }
        # Otherwise, count as FAIL
        else {
          Write-Host "[FAIL] $year/$baseName" -ForegroundColor Yellow
          $fail++
        }
      }
      # Most file extensions are skipped
      'tex' { Write-Host "[SKIP] $year/$baseName" -ForegroundColor DarkGray; $skip++ }
      'mp' { Write-Host "[SKIP] $year/$baseName"  -ForegroundColor DarkGray; $skip++ }
      'mpx' { Write-Host "[SKIP] $year/$baseName" -ForegroundColor DarkGray; $skip++ }
      'log' { Write-Host "[SKIP] $year/$baseName" -ForegroundColor DarkGray; $skip++ }
      'sav' { Write-Host "[SKIP] $year/$baseName" -ForegroundColor DarkGray; $skip++ }
      # Hehe
      'bak' { Write-Host "[SKIP] $year/$baseName" -ForegroundColor DarkGray; $skip++ }
      
      # Most files are actual images with numerical extensions (or none at all)
      default {
        # Prepare the path of the eps we'll run conversion on
        # If the original file is already .eps, keep its name
        $workEps = if ($extensionLower -eq 'eps') {
          Join-Path $destinationDir $baseName
        }
        # Otherwise, append .eps to the original file name (including its dots), e.g., c75i.50.eps
        else {
          Join-Path $destinationDir ($baseName + '.eps')
        }

        # Copy the original file to the working EPS path
        Copy-Item -LiteralPath $fullPath -Destination $workEps -Force

        # Invoke our EPS to SVG conversion script
        $code = Invoke-Converter -ScriptPath $epsConvPath -Args @('-EpsPath', $workEps, '-OutSvgPath', $outSvg)

        # If conversion succeeded and output SVG was created, count as OK
        if ($code -eq 0 -and (Test-Path -LiteralPath $outSvg)) {
          Write-Host "[OK]   $year/$baseName" -ForegroundColor Green          
          $ok++
        }
        # Otherwise, count as FAIL
        else {
          Write-Host "[FAIL] $year/$baseName" -ForegroundColor Yellow
          $fail++
        }
        
        # Delete the working EPS file after a conversion attempt
        Remove-Item -LiteralPath $workEps -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

# Final report
Write-Host ""; Write-Host "Done. Success: $ok, Skipped: $skip, Failed: $fail" -ForegroundColor Cyan; Write-Host ""