param([ValidateSet('all','development','gcp','tests')][string]$Profile='all')
$ErrorActionPreference='Stop'
$failed=$false
$tools=@('git','node','npm','python','docker')
if ($Profile -ne 'development') { $tools+='gcloud' }
foreach ($tool in $tools) {
 if (Get-Command $tool -ErrorAction SilentlyContinue) { Write-Host "OK $tool" }
 else { Write-Host "MISSING $tool : see docs/operacion-multiplataforma.md"; $failed=$true }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
 & node -e 'if(Number(process.versions.node.split(".")[0])!==24)process.exit(1)'
 if ($LASTEXITCODE) { Write-Host 'INCOMPATIBLE: Node 24 required'; $failed=$true }
}
if (Get-Command docker -ErrorAction SilentlyContinue) {
 & docker info *> $null
 if ($LASTEXITCODE) { Write-Host 'Docker daemon unavailable'; $failed=$true }
 & docker compose version
 if ($LASTEXITCODE) { $failed=$true }
}
if ($failed) { exit 1 }
