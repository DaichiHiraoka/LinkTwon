param(
  [Parameter(Mandatory = $true)][string]$UserPassword,
  [Parameter(Mandatory = $true)][string]$AdminPassword,
  [Parameter(Mandatory = $true)][string]$EventPassword,
  [Parameter(Mandatory = $true)][string]$StorePassword
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$base = 'https://linktwon-backend.onrender.com'
$storePortal = 'https://linktown-store-portal.vercel.app'
$output = Join-Path $PSScriptRoot 'api\extended-api-results.json'
$client = [System.Net.Http.HttpClient]::new()
$results = [System.Collections.Generic.List[object]]::new()

function Invoke-Api {
  param([string]$Method, [string]$Url, [object]$Body = $null, [string]$Token = $null)
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::$Method, $Url)
  if ($Token) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token) }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  }
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $parsed = $null
  if ($text) { try { $parsed = $text | ConvertFrom-Json } catch { $parsed = $text } }
  [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Add-Result {
  param([string]$Id, [string]$Name, [bool]$Passed, [string]$Observed)
  $results.Add([pscustomobject]@{
    test_id = $Id; name = $Name; passed = $Passed; observed = $Observed
    executed_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ssK')
  })
}

function Login-User([string]$Email, [string]$Password) {
  Invoke-Api -Method Post -Url "$base/auth/login" -Body @{ email = $Email; password = $Password }
}

$userLogin = Login-User 'demo@example.com' $UserPassword
$adminLogin = Invoke-Api -Method Post -Url "$base/auth/admin/login" -Body @{ admin_id = 'admin'; password = $AdminPassword }
if ($userLogin.Status -ne 200 -or $adminLogin.Status -ne 200) { throw 'Initial login failed.' }
$userToken = [string]$userLogin.Body.token
$adminToken = [string]$adminLogin.Body.token
$userId = [int]$userLogin.Body.user.user_id
$originalEmail = [string]$userLogin.Body.user.email
$originalPoints = [int]$userLogin.Body.user.points
$originalDetail = (Invoke-Api -Method Get -Url "$base/admin/users/$userId" -Token $adminToken).Body.user

try {
  # T-020: establish a known liked state, unlike it, and verify it disappears.
  $events = (Invoke-Api -Method Get -Url "$base/events?locale=ja" -Token $userToken).Body
  $eventId = [int]$events[0].event_id
  $null = Invoke-Api -Method Post -Url "$base/events/$eventId/like" -Token $userToken
  $unlike = Invoke-Api -Method Delete -Url "$base/events/$eventId/like" -Token $userToken
  $likedAfter = (Invoke-Api -Method Get -Url "$base/users/$userId/liked-events?locale=ja" -Token $userToken).Body
  $stillLiked = @($likedAfter | Where-Object { [int]$_.event_id -eq $eventId }).Count -gt 0
  Add-Result 'T-020' 'Unlike event and remove it from liked list' ($unlike.Status -eq 200 -and -not $stillLiked) "status=$($unlike.Status), still_liked=$stillLiked"

  # T-017: a paused event must not be accepted, then remove the fixture.
  $fixtureName = 'Evidence Paused Event ' + (Get-Date -Format 'yyyyMMddHHmmss')
  $createdEvent = Invoke-Api -Method Post -Url "$base/admin/events" -Token $adminToken -Body @{
    event_name = $fixtureName; event_datetime = '2026-12-31 10:00:00'; location = 'Evidence Lab'
    grant_points = 10; status = 'paused'; description = 'Temporary evidence fixture'
  }
  $pausedEventId = [int]$createdEvent.Body.event_id
  try {
    $pausedAttempt = Invoke-Api -Method Post -Url "$base/events/participate" -Token $userToken -Body @{ event_id = $pausedEventId }
    $pointsAfterPaused = [int](Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token $userToken).Body.points
    Add-Result 'T-017' 'Reject participation in paused event' ($createdEvent.Status -eq 201 -and $pausedAttempt.Status -eq 400 -and $pointsAfterPaused -eq $originalPoints) "create=$($createdEvent.Status), participate=$($pausedAttempt.Status), points_unchanged=$($pointsAfterPaused -eq $originalPoints)"
  } finally {
    if ($pausedEventId) { $null = Invoke-Api -Method Delete -Url "$base/admin/events/$pausedEventId" -Token $adminToken }
  }

  # T-030: temporarily reduce points, reject exchange, and restore the original balance.
  $services = (Invoke-Api -Method Get -Url "$base/points/services?locale=ja" -Token $userToken).Body
  $serviceId = [int]$services[0].service_id
  $null = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{ points = 0 }
  try {
    $exchange = Invoke-Api -Method Post -Url "$base/points/exchange" -Token $userToken -Body @{ service_id = $serviceId }
    $pointsAfterExchange = [int](Invoke-Api -Method Get -Url "$base/users/$userId/points" -Token $userToken).Body.points
    Add-Result 'T-030' 'Reject exchange when points are insufficient' ($exchange.Status -eq 400 -and $pointsAfterExchange -eq 0) "status=$($exchange.Status), points=$pointsAfterExchange, message=$($exchange.Body.message)"
  } finally {
    $null = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{ points = $originalPoints }
  }

  # T-037: change the email, login with it, restore, and verify the original login again.
  $temporaryEmail = "linktwon.evidence.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@example.com"
  $emailChanged = Invoke-Api -Method Put -Url "$base/users/$userId/email" -Token $userToken -Body @{ email = $temporaryEmail }
  try {
    $newEmailLogin = Login-User $temporaryEmail $UserPassword
    $oldEmailLogin = Login-User $originalEmail $UserPassword
    $emailPass = $emailChanged.Status -eq 200 -and $newEmailLogin.Status -eq 200 -and $oldEmailLogin.Status -ne 200
  } finally {
    $emailRestored = Invoke-Api -Method Put -Url "$base/users/$userId/email" -Token $userToken -Body @{ email = $originalEmail }
  }
  $restoredEmailLogin = Login-User $originalEmail $UserPassword
  Add-Result 'T-037' 'Change and restore login email' ($emailPass -and $emailRestored.Status -eq 200 -and $restoredEmailLogin.Status -eq 200) "changed=$($emailChanged.Status), new_login=$($newEmailLogin.Status), old_rejected=$($oldEmailLogin.Status), restored_login=$($restoredEmailLogin.Status)"

  # T-038: change password, verify old/new behavior, then restore. Admin update is the emergency recovery path.
  $temporaryPassword = 'Evidence-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $passwordChanged = Invoke-Api -Method Put -Url "$base/auth/password" -Token $userToken -Body @{ current_password = $UserPassword; new_password = $temporaryPassword }
  try {
    $oldPasswordLogin = Login-User $originalEmail $UserPassword
    $newPasswordLogin = Login-User $originalEmail $temporaryPassword
    if ($newPasswordLogin.Status -eq 200) {
      $passwordRestored = Invoke-Api -Method Put -Url "$base/auth/password" -Token ([string]$newPasswordLogin.Body.token) -Body @{ current_password = $temporaryPassword; new_password = $UserPassword }
    } else {
      $passwordRestored = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{ password = $UserPassword }
    }
  } catch {
    $passwordRestored = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{ password = $UserPassword }
    throw
  }
  $finalPasswordLogin = Login-User $originalEmail $UserPassword
  Add-Result 'T-038' 'Change password and restore original credential' ($passwordChanged.Status -eq 200 -and $oldPasswordLogin.Status -ne 200 -and $newPasswordLogin.Status -eq 200 -and $passwordRestored.Status -eq 200 -and $finalPasswordLogin.Status -eq 200) "changed=$($passwordChanged.Status), old_rejected=$($oldPasswordLogin.Status), new_login=$($newPasswordLogin.Status), restored_login=$($finalPasswordLogin.Status)"
  $userToken = [string]$finalPasswordLogin.Body.token

  # T-050: malformed QR must be rejected without creating an exchange.
  $storeBootstrapUrl = "$storePortal/api/bootstrap?code=store-demo&password=$([uri]::EscapeDataString($StorePassword))&locale=ja"
  $storeBootstrap = Invoke-Api -Method Get -Url $storeBootstrapUrl
  $storeServiceId = [string]$storeBootstrap.Body.services[0].service_id
  $storeFailure = Invoke-Api -Method Post -Url "$storePortal/api/store/exchanges?locale=ja" -Body @{
    code = 'store-demo'; password = $StorePassword; service_id = $storeServiceId; user_qr_payload = 'invalid-qr-payload'
  }
  Add-Result 'T-050' 'Reject malformed QR in store exchange' ($storeBootstrap.Status -eq 200 -and $storeFailure.Status -eq 400) "bootstrap=$($storeBootstrap.Status), exchange=$($storeFailure.Status), message=$($storeFailure.Body.message)"

  # T-058: update a harmless profile field, verify, restore, and verify again.
  $temporaryName = [string]$originalDetail.name + ' [evidence]'
  $adminUpdated = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{ name = $temporaryName }
  $updatedDetail = (Invoke-Api -Method Get -Url "$base/admin/users/$userId" -Token $adminToken).Body.user
  $adminRestored = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{
    name = [string]$originalDetail.name; age_group = $originalDetail.age_group; user_type = [string]$originalDetail.user_type; points = $originalPoints
  }
  $restoredDetail = (Invoke-Api -Method Get -Url "$base/admin/users/$userId" -Token $adminToken).Body.user
  Add-Result 'T-058' 'Admin updates and restores a user' ($adminUpdated.Status -eq 200 -and $updatedDetail.name -eq $temporaryName -and $adminRestored.Status -eq 200 -and $restoredDetail.name -eq $originalDetail.name) "updated=$($updatedDetail.name -eq $temporaryName), restored=$($restoredDetail.name -eq $originalDetail.name)"

  # T-052 authorization boundary can be checked without disclosing the key.
  $refreshUnauthorized = Invoke-Api -Method Post -Url "$base/api/translations/refresh"
  Add-Result 'T-052' 'Reject translation refresh without key' ($refreshUnauthorized.Status -eq 403) "status=$($refreshUnauthorized.Status), message=$($refreshUnauthorized.Body.message)"
} finally {
  # Last-resort restoration of critical demo fields.
  $null = Invoke-Api -Method Put -Url "$base/admin/users/$userId" -Token $adminToken -Body @{
    name = [string]$originalDetail.name; age_group = $originalDetail.age_group; user_type = [string]$originalDetail.user_type
    points = $originalPoints; password = $UserPassword
  }
  $currentLogin = Login-User $originalEmail $UserPassword
  if ($currentLogin.Status -ne 200) {
    $adminUsers = (Invoke-Api -Method Get -Url "$base/admin/users" -Token $adminToken).Body
    $currentDemo = $adminUsers | Where-Object { [int]$_.user_id -eq $userId }
    if ($currentDemo.email -ne $originalEmail) {
      $recoveryToken = [string](Login-User $currentDemo.email $UserPassword).Body.token
      if ($recoveryToken) { $null = Invoke-Api -Method Put -Url "$base/users/$userId/email" -Token $recoveryToken -Body @{ email = $originalEmail } }
    }
  }
  $finalProfile = Invoke-Api -Method Get -Url "$base/admin/users/$userId" -Token $adminToken
  Add-Result 'RESTORE' 'Demo user restored after evidence tests' ($finalProfile.Status -eq 200 -and $finalProfile.Body.user.email -eq $originalEmail -and [int]$finalProfile.Body.user.points -eq $originalPoints -and $finalProfile.Body.user.name -eq $originalDetail.name) "status=$($finalProfile.Status), email_restored=$($finalProfile.Body.user.email -eq $originalEmail), points_restored=$([int]$finalProfile.Body.user.points -eq $originalPoints), name_restored=$($finalProfile.Body.user.name -eq $originalDetail.name)"
  $client.Dispose()
}

$results | ConvertTo-Json -Depth 10 | Set-Content -Path $output -Encoding UTF8
$results | Format-Table test_id, passed, name, observed -AutoSize
