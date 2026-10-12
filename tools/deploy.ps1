<#
.SYNOPSIS
Uploads public Seekerblog files to the production FTP directory.

.DESCRIPTION
Uploads the files named with -Path, deployable Git changes with -Changed, or
every deployable public file with -All.
The FTP password is read from the Git-ignored .deploy-ftp.psd1 file when
present, then SEEKERBLOG_FTP_PASSWORD, otherwise the script asks for it
without displaying the value.

.EXAMPLE
.\tools\deploy.ps1 -Path gita/17/data.js -DryRun
.\tools\deploy.ps1 -Path gita/17/data.js,assets/js/gita-reader.js
.\tools\deploy.ps1 -Changed
.\tools\deploy.ps1 -All
#>
[CmdletBinding(DefaultParameterSetName = 'Paths')]
param(
  [Parameter(ParameterSetName = 'Paths', Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$Path,

  [Parameter(ParameterSetName = 'All', Mandatory = $true)]
  [switch]$All,

  [Parameter(ParameterSetName = 'Changed', Mandatory = $true)]
  [switch]$Changed,

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repoPrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$ftpHost = 'ftp.gauravw.com'
$ftpPort = 21
$ftpUser = 'gaurav@gauravw.com'
$remoteRoot = '/public_html/seekerblog'
$credentialsFile = Join-Path $repoRoot '.deploy-ftp.psd1'
$excludedTopLevelDirectories = @('.git', '.gita-work', '.kunjika-work', '.vishnu-work', 'authoring', 'graphify-out', 'tools', '__pycache__')
$excludedFiles = @('.gitignore')

function Get-RepositoryRelativePath([System.IO.FileInfo]$File) {
  $fullPath = [System.IO.Path]::GetFullPath($File.FullName)
  if (-not $fullPath.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "File is outside this repository: $fullPath"
  }
  return $fullPath.Substring($repoPrefix.Length).Replace('\', '/')
}

function Test-DeployablePath([string]$RelativePath) {
  if ($RelativePath -in $excludedFiles) {
    return $false
  }
  $topLevel = ($RelativePath -split '/')[0]
  return $topLevel -notin $excludedTopLevelDirectories
}

function Get-UploadFiles {
  if ($All) {
    return @(Get-ChildItem -LiteralPath $repoRoot -File -Recurse -Force |
      Where-Object { Test-DeployablePath (Get-RepositoryRelativePath $_) })
  }

  if ($Changed) {
    $changedPaths = @(
      & git -C $repoRoot diff --name-only
      & git -C $repoRoot diff --cached --name-only
      & git -C $repoRoot ls-files --others --exclude-standard
    ) | Sort-Object -Unique

    return @($changedPaths |
      Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf) } |
      ForEach-Object { Get-Item -LiteralPath (Join-Path $repoRoot $_) -Force } |
      Where-Object { Test-DeployablePath (Get-RepositoryRelativePath $_) } |
      Sort-Object FullName -Unique)
  }

  $files = foreach ($inputPath in ($Path -split ',')) {
    $resolved = Get-Item -LiteralPath $inputPath -Force
    if ($resolved.PSIsContainer) {
      Get-ChildItem -LiteralPath $resolved.FullName -File -Recurse -Force
    } else {
      $resolved
    }
  }
  return @($files |
    Where-Object { Test-DeployablePath (Get-RepositoryRelativePath $_) } |
    Sort-Object FullName -Unique)
}

function Get-Password {
  if (Test-Path -LiteralPath $credentialsFile -PathType Leaf) {
    $credentials = Import-PowerShellDataFile -LiteralPath $credentialsFile
    if (-not [string]::IsNullOrWhiteSpace($credentials.FtpPassword)) {
      return $credentials.FtpPassword
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($env:SEEKERBLOG_FTP_PASSWORD)) {
    return $env:SEEKERBLOG_FTP_PASSWORD
  }

  $securePassword = Read-Host 'FTP password' -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
}

$files = @(Get-UploadFiles)
if (-not $files.Count) {
  throw 'No deployable files were selected.'
}

foreach ($file in $files) {
  $relativePath = Get-RepositoryRelativePath $file
  $escapedPath = (($relativePath -split '/') | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/'
  $remoteUrl = "ftp://${ftpHost}:$ftpPort${remoteRoot}/$escapedPath"

  if ($DryRun) {
    Write-Output "Would upload $relativePath -> $remoteRoot/$relativePath"
  }
}

if ($DryRun) {
  Write-Output "Dry run complete: $($files.Count) file(s) selected."
  exit 0
}

$password = Get-Password
try {
  foreach ($file in $files) {
    $relativePath = Get-RepositoryRelativePath $file
    $escapedPath = (($relativePath -split '/') | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join '/'
    $remoteUrl = "ftp://${ftpHost}:$ftpPort${remoteRoot}/$escapedPath"

    Write-Output "Uploading $relativePath"
    & curl.exe --fail --silent --show-error --ftp-pasv --ftp-create-dirs --user "${ftpUser}:$password" --upload-file $file.FullName $remoteUrl
    if ($LASTEXITCODE -ne 0) {
      throw "Upload failed for $relativePath (curl exit code $LASTEXITCODE)."
    }
  }
} finally {
  $password = $null
}

Write-Output "Deployment complete: $($files.Count) file(s) uploaded to $remoteRoot."
