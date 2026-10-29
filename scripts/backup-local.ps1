param(
  [Parameter(Mandatory=$true)][string]$Container,
  [Parameter(Mandatory=$true)][string]$Database,
  [Parameter(Mandatory=$true)][string]$DatabaseUser,
  [Parameter(Mandatory=$true)][string]$IndependentRoot
)
$ErrorActionPreference='Stop'
if ($Database -notmatch '^[a-zA-Z0-9_]+$' -or $DatabaseUser -notmatch '^[a-zA-Z0-9_]+$') { throw 'Invalid database identifier' }
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupStamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$backupPath=Join-Path $projectRoot "backups/safety-$backupStamp"
$secondPath=Join-Path ([IO.Path]::GetFullPath($IndependentRoot)) "safety-$backupStamp"
if ([IO.Path]::GetPathRoot($backupPath) -eq [IO.Path]::GetPathRoot($secondPath)) { throw 'Independent destination must be on another drive' }
New-Item -ItemType Directory -Path $backupPath -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Path $secondPath -ErrorAction Stop | Out-Null
$containerDump="/tmp/lhl76-$backupStamp.dump"
& docker exec $Container pg_dump -U $DatabaseUser -d $Database -Fc -f $containerDump
if($LASTEXITCODE -ne 0){throw 'Database dump failed'}
& docker cp "${Container}:$containerDump" (Join-Path $backupPath 'database.dump')
if($LASTEXITCODE -ne 0){throw 'Database dump copy failed'}
# Immutable originals and uploads are retained. Do not run file deletion or
# replacement jobs concurrently; coordinate a maintenance window for those.
Compress-Archive -LiteralPath (Join-Path $projectRoot 'public') -DestinationPath (Join-Path $backupPath 'public-files.zip') -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $backupPath 'database.dump'),(Join-Path $backupPath 'public-files.zip') -Destination $secondPath -ErrorAction Stop
$verification=@('database.dump','public-files.zip') | ForEach-Object {
 $first=(Get-FileHash -LiteralPath (Join-Path $backupPath $_) -Algorithm SHA256).Hash
 $second=(Get-FileHash -LiteralPath (Join-Path $secondPath $_) -Algorithm SHA256).Hash
 if($first -ne $second){throw 'Backup checksum mismatch'}
 [PSCustomObject]@{File=$_;SHA256=$first;IndependentCopyMatches=$true}
}
$verification | Format-Table
Write-Output "Backup saved: $backupPath"
Write-Output "Independent copy saved: $secondPath"
Write-Warning 'Restore has NOT been tested by this script. Restore only into a separately verified empty test database, never over working data.'
# Deliberately no deletion, rotation, restore, migration or change of DATABASE_URL.
