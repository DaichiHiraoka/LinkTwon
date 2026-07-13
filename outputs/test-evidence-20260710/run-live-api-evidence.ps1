param(
  [Parameter(Mandatory = $true)][string]$UserPassword,
  [Parameter(Mandatory = $true)][string]$AdminPassword,
  [Parameter(Mandatory = $true)][string]$EventPassword,
  [Parameter(Mandatory = $true)][string]$StorePassword
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$base = 'https://linktwon-backend.onrender.com'
$eventPortal = 'https://linktown-event-portal.vercel.app'
$storePortal = 'https://linktown-store-portal.vercel.app'
$output = Join-Path $PSScriptRoot 'api\live-api-results.json'
$client = [System.Net.Http.HttpClient]::new()
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null,
    [string]$Token = $null
  )

  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::$Method, $Url)
  if ($Token) {
    $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
  }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 8 -Compress
    $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  }
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $parsed = $null
  if ($text) {
    try { $parsed = $text | ConvertFrom-Json } catch { $parsed = $text }
  }
  [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Add-Result {
  param([string]$Id, [string]$Name, [object]$Response, [int[]]$Expected)
  $results.Add([pscustomobject]@{
    test_id = $Id
    name = $Name
    status_code = $Response.Status
    expected_status = ($Expected -join ',')
    passed = $Expected -contains $Response.Status
    observed = if ($Response.Body.message) { [string]$Response.Body.message } else { 'response received' }
    executed_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
  })
}

$health = Invoke-Api -Method Get -Url "$base/health"
Add-Result 'ENV-001' 'Backend health' $health @(200)

$badLogin = Invoke-Api -Method Post -Url "$base/auth/login" -Body @{ email = 'demo@example.com'; password = 'invalid-password' }
Add-Result 'T-003' 'Invalid user login is rejected' $badLogin @(400, 401)

$login = Invoke-Api -Method Post -Url "$base/auth/login" -Body @{ email = 'demo@example.com'; password = $UserPassword }
Add-Result 'T-002' 'Valid user login' $login @(200)
$userToken = [string]$login.Body.token
$userId = [int]$login.Body.user.user_id

$expired = Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token 'expired.invalid.token'
Add-Result 'T-007' 'Invalid or expired token is rejected' $expired @(401, 403)

if ($userToken) {
  Add-Result 'T-011' 'Event list API' (Invoke-Api -Method Get -Url "$base/events?locale=ja" -Token $userToken) @(200)
  Add-Result 'T-024' 'Point balance API' (Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token $userToken) @(200)
  Add-Result 'T-024' 'Point history API' (Invoke-Api -Method Get -Url "$base/users/$userId/history?locale=ja" -Token $userToken) @(200)
  Add-Result 'T-027' 'Service list API' (Invoke-Api -Method Get -Url "$base/points/services?locale=ja" -Token $userToken) @(200)
  Add-Result 'T-032' 'Account settings API' (Invoke-Api -Method Get -Url "$base/users/$userId/settings" -Token $userToken) @(200)
  Add-Result 'T-039' 'Notification list API' (Invoke-Api -Method Get -Url "$base/users/$userId/notifications?locale=ja" -Token $userToken) @(200)
  Add-Result 'T-041' 'Support ticket list API' (Invoke-Api -Method Get -Url "$base/support/tickets" -Token $userToken) @(200)
  Add-Result 'T-055' 'Regular user cannot access admin API' (Invoke-Api -Method Get -Url "$base/admin/users" -Token $userToken) @(403)

  $before = Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token $userToken
  $purchaseFail = Invoke-Api -Method Post -Url "$base/points/purchase" -Body @{ points = 100; simulate_status = 'failed' } -Token $userToken
  $after = Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token $userToken
  $unchanged = ([int]$before.Body.points -eq [int]$after.Body.points)
  $results.Add([pscustomobject]@{
    test_id = 'T-026'; name = 'Failed mock purchase does not change balance'; status_code = $purchaseFail.Status
    expected_status = '201 with failed status'; passed = ($purchaseFail.Status -eq 201 -and $purchaseFail.Body.status -eq 'failed' -and $unchanged)
    observed = "purchase status=$($purchaseFail.Body.status), balance unchanged=$unchanged"; executed_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
  })
}

$adminLogin = Invoke-Api -Method Post -Url "$base/auth/admin/login" -Body @{ admin_id = 'admin'; password = $AdminPassword }
Add-Result 'T-054' 'Valid admin login' $adminLogin @(200)
$adminToken = [string]$adminLogin.Body.token
if ($adminToken) {
  Add-Result 'T-056' 'Admin event list API' (Invoke-Api -Method Get -Url "$base/admin/events" -Token $adminToken) @(200)
  Add-Result 'T-057' 'Admin store list API' (Invoke-Api -Method Get -Url "$base/admin/stores" -Token $adminToken) @(200)
  Add-Result 'T-057' 'Admin service list API' (Invoke-Api -Method Get -Url "$base/admin/services" -Token $adminToken) @(200)
  Add-Result 'T-058' 'Admin user list API' (Invoke-Api -Method Get -Url "$base/admin/users" -Token $adminToken) @(200)
  Add-Result 'T-060' 'Admin support list API' (Invoke-Api -Method Get -Url "$base/admin/support/tickets" -Token $adminToken) @(200)
  Add-Result 'ADMIN-STATS' 'Admin statistics API' (Invoke-Api -Method Get -Url "$base/admin/stats" -Token $adminToken) @(200)
}

$eventUrl = "$eventPortal/api/bootstrap?code=event-demo&password=$([uri]::EscapeDataString($EventPassword))&locale=ja"
Add-Result 'T-042' 'Event organizer portal login API' (Invoke-Api -Method Get -Url $eventUrl) @(200)
$eventBadUrl = "$eventPortal/api/bootstrap?code=event-demo&password=invalid&locale=ja"
Add-Result 'T-043' 'Invalid event organizer login is rejected' (Invoke-Api -Method Get -Url $eventBadUrl) @(401)

$storeUrl = "$storePortal/api/bootstrap?code=store-demo&password=$([uri]::EscapeDataString($StorePassword))&locale=ja"
Add-Result 'T-048' 'Store portal login API' (Invoke-Api -Method Get -Url $storeUrl) @(200)
$storeBadUrl = "$storePortal/api/bootstrap?code=store-demo&password=invalid&locale=ja"
Add-Result 'T-048' 'Invalid store login is rejected' (Invoke-Api -Method Get -Url $storeBadUrl) @(401)

$client.Dispose()
$results | ConvertTo-Json -Depth 8 | Set-Content -Path $output -Encoding UTF8
$results | Format-Table test_id, passed, status_code, name -AutoSize
