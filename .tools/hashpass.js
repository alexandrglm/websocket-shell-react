import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
    console.error('Usage: node hash-password.js <your-password>');
    process.exit(1);
}

bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        process.exit(1);
    }
    console.log('\nYour hashed password:');
    console.log(hash);
    console.log('\nAdd this to your .env file as SHELL_HASHWORD');
});
