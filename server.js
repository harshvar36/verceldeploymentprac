require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const xlsx = require('xlsx');

const app = express();
app.use(bodyParser.json());

// CORS configuration
const allowedOrigins = ['https://makeit-fawn.vercel.app'];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    phone: { type: String, unique: true },
}, { timestamps: true }); // Add timestamps for submission tracking

const User = mongoose.model('User', userSchema);

// Route for form submission
// Route for form submission
app.post('/api/submit', async (req, res) => {
    const { name, email, phone } = req.body;

    // Trim and validate input on the backend as well
    if (!name || !phone || name.trim().length < 2 || phone.trim().length < 5) {
        return res.status(400).json({ message: 'Invalid input. Please provide a valid name and phone number.' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ message: 'A submission with this email or phone number already exists.' });
        }

        const newUser = new User({ name: name.trim(), email, phone: phone.trim() });
        await newUser.save();
        res.status(201).json({ message: 'User submitted successfully!' });
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ message: 'An error occurred while saving data.' });
    }
});


// Route to download responses in Excel format
app.post('/api/download', async (req, res) => {
    const { password } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ message: 'Unauthorized access.' });
    }

    try {
        const users = await User.find().lean();
        const excelData = users.map(user => ({
            Name: user.name,
            Email: user.email,
            Phone: user.phone,
            SubmittedAt: user.createdAt,
        }));

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Responses');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.set({
            'Content-Disposition': 'attachment; filename="responses.xlsx"',
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        res.send(buffer);
    } catch (error) {
        console.error('Error generating Excel document:', error);
        res.status(500).json({ message: 'Error generating Excel document.' });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
