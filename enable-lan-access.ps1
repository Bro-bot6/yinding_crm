$ErrorActionPreference = 'Stop'

$expectedNetwork = 'YD-5G'
$profile = Get-NetConnectionProfile -InterfaceAlias 'WLAN'
if ($profile.Name -ne $expectedNetwork) {
    throw "Current WLAN is '$($profile.Name)', not the approved company network '$expectedNetwork'."
}

if ($profile.NetworkCategory -ne 'Private') {
    Set-NetConnectionProfile -InterfaceAlias 'WLAN' -NetworkCategory Private
}

$firewallName = 'Yinding CRM - Company LAN'
$firewallRule = Get-NetFirewallRule -DisplayName $firewallName -ErrorAction SilentlyContinue
if ($firewallRule) {
    Set-NetFirewallRule `
        -DisplayName $firewallName `
        -Enabled True `
        -Direction Inbound `
        -Action Allow `
        -Profile Private,Domain | Out-Null
    Set-NetFirewallAddressFilter `
        -AssociatedNetFirewallRule $firewallRule `
        -RemoteAddress LocalSubnet | Out-Null
    Set-NetFirewallPortFilter `
        -AssociatedNetFirewallRule $firewallRule `
        -Protocol TCP `
        -LocalPort 8000 | Out-Null
} else {
    New-NetFirewallRule `
        -DisplayName $firewallName `
        -Description 'Allow Yinding CRM from the local company subnet only.' `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 8000 `
        -Profile Private,Domain `
        -RemoteAddress LocalSubnet | Out-Null
}

Write-Output 'Company LAN access is enabled for YD-5G only.'
