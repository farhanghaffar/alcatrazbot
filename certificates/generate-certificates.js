const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

// Generate self-signed certificate with IP in SAN
const attrs = [
    { name: 'commonName', value: '182.180.172.81' },
    { name: 'organizationName', value: 'Development Test Server' },
    { name: 'countryName', value: 'US' }
];

const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [{
        name: 'subjectAltName',
        altNames: [
            { type: 7, ip: '182.180.172.81' }, // IP
            { type: 2, value: 'localhost' }     // DNS
        ]
    }]
});

// Ensure certificates directory exists
const certDir = path.join(__dirname);
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
}

// Write certificate files
fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);

console.log('SSL certificates generated successfully!');
