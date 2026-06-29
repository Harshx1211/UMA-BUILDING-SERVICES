$regexReplacements = @{
    "'#fff'" = "'var(--card)'"
    "'#ffffff'" = "'var(--card)'"
    "'#f8fafc'" = "'var(--bg)'"
    "'#f0f4ff'" = "'var(--primary-light)'"
    "'#fff7ed'" = "'rgba(249,115,22,0.15)'"
    "'#fef2f2'" = "'rgba(239,68,68,0.15)'"
    "'#f0fdf4'" = "'rgba(34,197,94,0.15)'"
    "'#fffbeb'" = "'rgba(245,158,11,0.15)'"
    "'#fff4ed'" = "'rgba(249,115,22,0.15)'"
    "'#eff6ff'" = "'var(--primary-light)'"
    "hover:bg-gray-50" = "hover:bg-white/5"
    "bg-gray-50" = "bg-white/5"
}

Get-ChildItem -Path ".\src" -Filter *.tsx -Recurse | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw
    $newContent = $content
    
    foreach ($key in $regexReplacements.Keys) {
        $newContent = [regex]::Replace($newContent, [regex]::Escape($key), $regexReplacements[$key])
    }
    
    if ($content -ne $newContent) {
        Set-Content -LiteralPath $_.FullName -Value $newContent
        Write-Host "Polished UI colors in: $($_.Name)"
    }
}
Write-Host "Final UI sweep completed!"
