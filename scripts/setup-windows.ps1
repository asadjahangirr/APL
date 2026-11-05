param([switch]$UseSystemTempOnC)
$ErrorActionPreference = 'Stop'
$setupRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\setup'
New-Item -ItemType Directory -Path $setupRoot -Force | Out-Null
$reportPath = Join-Path $setupRoot 'windows-prerequisites.json'
$report = [ordered]@{ Status = 'started'; ChangedSystemTemp = $false; RestartRequired = $false; Features = @(); Error = $null }
Start-Transcript -Path (Join-Path $setupRoot 'windows-prerequisites.log') -Append | Out-Null
try {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script from PowerShell as Administrator. It never restarts Windows automatically.'
    }
    if ($UseSystemTempOnC) {
        # Only use this switch after the computer owner approves the two machine-wide settings.
        $target = 'C:\Windows\Temp'
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        $backup = Join-Path $setupRoot 'system-temp-before.json'
        if (-not (Test-Path -LiteralPath $backup)) {
            @{ TEMP = [Environment]::GetEnvironmentVariable('TEMP','Machine'); TMP = [Environment]::GetEnvironmentVariable('TMP','Machine') } |
                ConvertTo-Json | Set-Content -LiteralPath $backup -Encoding UTF8
        }
        [Environment]::SetEnvironmentVariable('TEMP', $target, 'Machine')
        [Environment]::SetEnvironmentVariable('TMP', $target, 'Machine')
        $env:TEMP = $target
        $env:TMP = $target
        $report.ChangedSystemTemp = $true
        # Already-running system services can retain the old environment.
        $report.RestartRequired = $true
    }
    $scratch = Join-Path $setupRoot 'dism-scratch'
    New-Item -ItemType Directory -Path $scratch -Force | Out-Null
    foreach ($featureName in @('VirtualMachinePlatform', 'Microsoft-Windows-Subsystem-Linux')) {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $featureName
        $before = [string]$feature.State
        if ($feature.State -ne 'Enabled') {
            Write-Output ('Enabling ' + $featureName + ' without restarting Windows...')
            $enabled = Enable-WindowsOptionalFeature -Online -FeatureName $featureName -All -NoRestart -ScratchDirectory $scratch
            if ($enabled.RestartNeeded) { $report.RestartRequired = $true }
        }
        $after = [string](Get-WindowsOptionalFeature -Online -FeatureName $featureName).State
        $report.Features += @{ Name = $featureName; Before = $before; After = $after }
    }
    $report.Status = if ($report.RestartRequired) { 'restart-required' } else { 'ready-for-wsl-install' }
    Write-Output 'Prerequisite changes finished. No restart was performed.'
} catch {
    $report.Status = 'failed'
    $report.Error = $_.Exception.Message
    Write-Output $report.Error
    $global:LASTEXITCODE = 1
} finally {
    $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Stop-Transcript | Out-Null
}
if ($report.Status -eq 'failed') { exit 1 }
