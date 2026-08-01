#Requires -RunAsAdministrator

$rules = @(
    @{ Name = 'Arepa Frontend LAN'; Port = 3000 },
    @{ Name = 'Arepa Backend LAN'; Port = 8000 }
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -DisplayName $rule.Name -Enabled True -Action Allow -Profile Any
        continue
    }

    New-NetFirewallRule `
        -DisplayName $rule.Name `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $rule.Port `
        -RemoteAddress LocalSubnet `
        -Profile Any | Out-Null
}
