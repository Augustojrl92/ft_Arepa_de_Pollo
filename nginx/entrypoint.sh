#!/bin/sh
set -eu

CERT_DIR=/etc/nginx/certs
CERT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"

# Subject Alternative Names the certificate is valid for. Browsers match on SAN,
# not on the Common Name, so the address the app is actually opened at has to be
# listed here — add the machine's LAN IP via TLS_SAN when testing from another
# computer.
TLS_SAN="${TLS_SAN:-DNS:localhost,DNS:*.localhost,IP:127.0.0.1}"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
	echo "==> No certificate found, generating a self-signed one for: $TLS_SAN"
	openssl req -x509 -nodes -newkey rsa:2048 \
		-days 825 \
		-keyout "$KEY" \
		-out "$CERT" \
		-subj "/C=ES/ST=Madrid/L=Madrid/O=AEDLPH/CN=localhost" \
		-addext "subjectAltName=$TLS_SAN" \
		-addext "keyUsage=digitalSignature,keyEncipherment" \
		-addext "extendedKeyUsage=serverAuth" \
		2>/dev/null
	chmod 600 "$KEY"
	echo "==> Certificate created. Browsers will warn once because nobody trusts us yet."
else
	echo "==> Reusing the existing certificate in $CERT_DIR"
fi

exec "$@"
