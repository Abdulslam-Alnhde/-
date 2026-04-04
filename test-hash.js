const bcrypt = require('bcryptjs');
const match = bcrypt.compareSync('Admin@2026', '$2b$12$5m82ptkKDwOxwcSUA94MCumjiMLz2miDRfs9yg4Na.t3KeSpeo21S');
console.log('Match?', match);
