$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gitCommonDir = (& git -C $projectDir rev-parse --path-format=absolute --git-common-dir 2>$null)
if ($LASTEXITCODE -eq 0 -and $gitCommonDir) {
    $sharedRoot = Split-Path -Parent $gitCommonDir.Trim()
} else {
    $sharedRoot = $projectDir
}

$logDir = Join-Path $sharedRoot 'logs'
$logFile = Join-Path $logDir 'health-monitor.log'
$statusFile = Join-Path $logDir 'health-status.json'
$healthUrl = 'http://127.0.0.1:8000/health/'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Write-MonitorLog([string]$message) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Test-CrmHealth {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 8
        if ($response.StatusCode -eq 200) {
            return @{ Healthy = $true; Error = $null }
        }
        return @{ Healthy = $false; Error = "HTTP $($response.StatusCode)" }
    } catch {
        return @{ Healthy = $false; Error = $_.Exception.Message }
    }
}

function Write-HealthStatus([bool]$healthy, [string]$state, [string]$errorMessage) {
    @{
        checked_at = (Get-Date).ToString('o')
        healthy = $healthy
        state = $state
        url = $healthUrl
        error = $errorMessage
    } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
}

$result = Test-CrmHealth
if ($result.Healthy) {
    Write-HealthStatus $true 'healthy' $null
    exit 0
}

Write-MonitorLog "Health check failed; retrying in 10 seconds: $($result.Error)"
Start-Sleep -Seconds 10
$retry = Test-CrmHealth
if ($retry.Healthy) {
    Write-MonitorLog 'Health check recovered without restart.'
    Write-HealthStatus $true 'healthy-after-retry' $null
    exit 0
}

Write-MonitorLog "CRM remains unhealthy; restarting YindingCRMServer: $($retry.Error)"
try {
    Stop-ScheduledTask -TaskName 'YindingCRMServer' -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-ScheduledTask -TaskName 'YindingCRMServer'
} catch {
    Write-MonitorLog "Unable to restart scheduled task: $($_.Exception.Message)"
    Write-HealthStatus $false 'restart-failed' $_.Exception.Message
    exit 1
}

for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 3
    $recovered = Test-CrmHealth
    if ($recovered.Healthy) {
        Write-MonitorLog "CRM recovered after restart (attempt $attempt)."
        Write-HealthStatus $true 'recovered-after-restart' $null
        exit 0
    }
}

$finalError = $recovered.Error
Write-MonitorLog "CRM failed to recover within 90 seconds: $finalError"
Write-HealthStatus $false 'unhealthy-after-restart' $finalError
exit 1
