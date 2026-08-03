$client = New-Object System.Net.Sockets.UdpClient

try {
	$client.Connect('8.8.8.8', 53)
	$client.Client.LocalEndPoint.Address.IPAddressToString
} finally {
	$client.Dispose()
}
