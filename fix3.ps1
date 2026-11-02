$c = Get-Content 'backend/src/services/solicitudService.js' -Raw
$idx = $c.IndexOf('se resolvi')
$start = $c.LastIndexOf("if (estadoNuevo === 'resuelta')", $idx)
$end = $c.IndexOf('return solicitud;', $start) + 20
$sub = $c.Substring($start, $end - $start)
Write-Output $sub
