$replacements = @{
    "background: '#fff'" = "background: 'var(--card)'"
    "background: '#f8fafc'" = "background: 'var(--bg)'"
    "background: '#f0f4ff'" = "background: 'var(--primary-light)'"
    "background: '#fff7ed'" = "background: 'rgba(249,115,22,0.15)'"
    "background: '#fef2f2'" = "background: 'rgba(239,68,68,0.15)'"
    "background: '#f0fdf4'" = "background: 'rgba(34,197,94,0.15)'"
    "background: '#fffbeb'" = "background: 'rgba(245,158,11,0.15)'"
    "background: '#fff4ed'" = "background: 'rgba(249,115,22,0.15)'"
    "background = '#fff'" = "background = 'var(--card)'"
    "background = '#f8fafc'" = "background = 'var(--bg)'"
    "bg: '#fff'" = "bg: 'var(--card)'"
    "bg: '#f8fafc'" = "bg: 'var(--bg)'"
    "bg: '#fff7ed'" = "bg: 'rgba(249,115,22,0.15)'"
    "bg: '#fef2f2'" = "bg: 'rgba(239,68,68,0.15)'"
    "bg: '#f0fdf4'" = "bg: 'rgba(34,197,94,0.15)'"
    "bg: '#fffbeb'" = "bg: 'rgba(245,158,11,0.15)'"
}

Get-ChildItem -Path ".\src" -Filter *.tsx -Recurse | ForEach-Object {
    $content = Get-Content -LiteralPath $_.FullName -Raw
    $newContent = $content
    
    foreach ($key in $replacements.Keys) {
        $newContent = $newContent.Replace($key, $replacements[$key])
    }
    
    if ($content -ne $newContent) {
        Set-Content -LiteralPath $_.FullName -Value $newContent
        Write-Host "Fixed inline colors: $($_.Name)"
    }
}
Write-Host "All inline styles migrated to dark mode!"
