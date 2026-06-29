Get-ChildItem -Path ".\src" -Filter *.tsx -Recurse | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    # Replace bg-white with bg-[var(--card)] but skip bg-white/10 opacity modifiers
    $newContent = [regex]::Replace($content, 'bg-white(?!/)', 'bg-[var(--card)]')
    if ($content -ne $newContent) {
        Set-Content -Path $_.FullName -Value $newContent
        Write-Host "Fixed: $($_.Name)"
    }
}
Write-Host "All UI cards have been migrated to the dark-navy theme!"
