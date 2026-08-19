$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = Join-Path $projectDir '.venv\Scripts\pythonw.exe'
$serverScript = Join-Path $projectDir 'serve-crm.py'
$backupScript = Join-Path $projectDir 'backup-crm.pyw'
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path $pythonw)) {
    throw "Python environment not found: $pythonw"
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

Start-ScheduledTask -TaskName 'YindingCRMServer'

Write-Output 'Yinding CRM scheduled tasks are installed.'
