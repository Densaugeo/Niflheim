# Niflheim

[![Code Climate](https://codeclimate.com/github/Densaugeo/Niflheim/badges/gpa.svg)](https://codeclimate.com/github/Densaugeo/Niflheim)

[![Dependency Status](https://gemnasium.com/Densaugeo/Niflheim.svg)](https://gemnasium.com/Densaugeo/Niflheim)

Make ssl certificates:

~~~
# Generate private key
openssl genrsa --out test.key 1024

# Or generate private key with passphrase
openssl genrsa -des3 -out test.key 1024

# Passphrase can be removed later
openssl rsa -in test.key -out test.key.raw

# Generate certificate signing request
openssl req -new -sha256 -key test.key -out test.csr

# Sign CSR with its own private key
openssl x509 -req -sha256 -days 365 -in test.csr -out test.crt -signkey test.key
~~~
