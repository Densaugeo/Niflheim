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

ZeroMQ version 3 (not 2) is required before install npm or Rust dependencies

~~~
sudo yum install zeromq3-devel
~~~

Compile Rust parts:

~~~
# Install Rust
# Download .tar from http://www.rust-lang.org/install.html for your platform
# Extract
tar -xzf rust-*.tar.gz
# Run install script
sudo ./rust-*/install.sh
# The temporary install folder can be removed
rm -rf ./rust-*/

# Install Rust dependencies
cargo build

# May need to add environment variable for cargo to run
export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:/usr/local/lib
# or add LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:/usr/local/lib to ~/.bash_profile
~~~
