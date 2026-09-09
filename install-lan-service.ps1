$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gitCommonDir = (& git -C $projectDir rev-parse --path-format=absolute --git-common-dir 2>$null)
if ($LASTEXITCODE -eq 0 -and $gitCommonDir) {
    $sharedRoot = Split-Path -Parent $gitCommonDir.Trim()
} else {
    $sharedRoot = $projectDir
}
$pythonw = Join-Path $sharedRoot '.venv\Scripts\pythonw.exe'
$serverScript = Join-Path $projectDir 'serve-crm.py'
$backupScript = Join-Path $projectDir 'backup-crm.pyw'
$monitorScript = Join-Path $projectDir 'monitor-crm.ps1'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path $pythonw)) {
    throw "Python environment not found: $pythonw"
}
if (-not (Test-Path $monitorScript)) {
    throw "Health monitor not found: $monitorScript"
}

$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType Interactive `
    -RunLevel Limited

$serverAction = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument ('"{0}"' -f $serverScript) `
    -WorkingDirectory $projectDir
$serverTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$serverSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 3650) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName 'YindingCRMServer' `
    -Description 'Yinding CRM LAN server; starts at logon and restarts after failure.' `
    -Action $serverAction `
    -Trigger $serverTrigger `
    -Settings $serverSettings `
    -Principal $principal `
    -Force | Out-Null

$dailyBackupAction = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument ('"{0}"' -f $backupScript) `
    -WorkingDirectory $projectDir
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '21:00'
$backupSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName 'YindingCRMBackup' `
    -Description 'Daily CRM database backup and Excel customer export.' `
    -Action $dailyBackupAction `
    -Trigger $backupTrigger `
    -Settings $backupSettings `
    -Principal $principal `
    -Force | Out-Null

$monitorAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $monitorScript) `
    -WorkingDirectory $projectDir
$monitorTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$monitorSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 4) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName 'YindingCRMHealthMonitor' `
    -Description 'Checks the local CRM every five minutes and restarts it if unhealthy.' `
    -Action $monitorAction `
    -Trigger $monitorTrigger `
    -Settings $monitorSettings `
    -Principal $principal `
    -Force | Out-Null

Start-ScheduledTask -TaskName 'YindingCRMServer'

$healthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Seconds 3
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health/' -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # The next iteration retries while migrations and static collection finish.
    }
}

if (-not $healthy) {
    $taskInfo = Get-ScheduledTaskInfo -TaskName 'YindingCRMServer'
    throw "CRM did not become healthy within 90 seconds. Task result=$($taskInfo.LastTaskResult). Check $(Join-Path $sharedRoot 'logs\server.log')."
}

$lanAddress = (& powershell.exe -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'WLAN' -ErrorAction SilentlyContinue | Where-Object { `$_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)")
Write-Output 'Yinding CRM scheduled tasks are installed and the service is healthy.'
Write-Output 'Local: http://127.0.0.1:8000/'
if ($lanAddress) {
    Write-Output ("LAN: http://{0}:8000/" -f $lanAddress.Trim())
}
