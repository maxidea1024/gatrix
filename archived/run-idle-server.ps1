$env:REDIS_PORT = "6379"
$env:REDIS_HOST = "localhost"
$env:GATRIX_URL = "http://localhost:55000"
$env:API_TOKEN = "gatrix-unsecured-server-api-token"

Set-Location "c:\github\admin-templates\gatrix\packages\sdks\server-sdk"
npx ts-node test-servers/idle-server.ts

