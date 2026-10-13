// ============================================================
//  Book Routes
//  CRUD operations + Issue / Return workflow + Reports
// ============================================================

const express = require('express');
const PDFDocument = require('pdfkit');
const Book = require('../models/Book');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const { protect, roleGuard } = require('../middleware/authMiddleware');

const router = express.Router();

// ── GET /api/books — List / Search books (authenticated) ────
router.get('/', protect, async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { author: { $regex: search, $options: 'i' } },
                    { isbn: { $regex: search, $options: 'i' } },
                    { department: { $regex: search, $options: 'i' } },
                ],
            };
        }

        const books = await Book.find(query).populate('issuedTo.user', 'name userId department');
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching books', error: error.message });
    }
});

// ── POST /api/books — Add a book (librarian only) ───────────
router.post('/', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { title, author, isbn, quantity, department } = req.body;

        if (!title || !author || !isbn) {
            return res.status(400).json({ message: 'Title, Author, and ISBN are required' });
        }

        // Check for duplicate ISBN
        const existing = await Book.findOne({ isbn });
        if (existing) {
            return res.status(400).json({ message: 'A book with this ISBN already exists' });
        }

        const book = await Book.create({
            title,
            author,
            isbn,
            quantity: quantity || 1,
            available: quantity || 1,
            department: department || 'Other',
        });

        res.status(201).json({ message: 'Book added successfully', book });
    } catch (error) {
        res.status(500).json({ message: 'Error adding book', error: error.message });
    }
});

// ── PUT /api/books/:id — Update a book (librarian only) ─────
router.put('/:id', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { title, author, isbn, quantity, department } = req.body;

        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        // Recalculate available copies
        const issuedCount = book.issuedTo.length;
        const newQuantity = quantity !== undefined ? parseInt(quantity) : book.quantity;

        if (newQuantity < issuedCount) {
            return res.status(400).json({
                message: `Cannot reduce quantity below ${issuedCount} (currently issued copies)`,
            });
        }

        book.title = title || book.title;
        book.author = author || book.author;
        book.isbn = isbn || book.isbn;
        book.department = department || book.department;
        book.quantity = newQuantity;
        book.available = newQuantity - issuedCount;

        await book.save();
        res.json({ message: 'Book updated successfully', book });
    } catch (error) {
        res.status(500).json({ message: 'Error updating book', error: error.message });
    }
});

// ── DELETE /api/books/:id — Delete a book (librarian only) ──
router.delete('/:id', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }

        if (book.issuedTo.length > 0) {
            return res.status(400).json({ message: 'Cannot delete — book has outstanding issues' });
        }

        await Book.findByIdAndDelete(req.params.id);
        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting book', error: error.message });
    }
});

// ── POST /api/books/issue-book — Issue a book to a student ──
router.post('/issue-book', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { bookId, studentId } = req.body;

        if (!bookId || !studentId) {
            return res.status(400).json({ message: 'Book ID and Student ID are required' });
        }

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        if (book.available <= 0) {
            return res.status(400).json({ message: 'No copies available for issue' });
        }

        const student = await User.findOne({ userId: studentId, role: 'student' });
        if (!student) return res.status(404).json({ message: 'Student not found with that Register Number' });

        if (student.fineBalance > 0) {
            return res.status(400).json({ message: 'Cannot issue book. Student has unpaid fines.' });
        }

        const activeIssues = student.borrowedBooks.filter(b => b.status === 'issued').length;
        if (activeIssues >= 3) {
            return res.status(400).json({ message: 'Cannot issue book. Borrow limit of 3 reached.' });
        }

        // Check if student already has this book
        const alreadyIssued = student.borrowedBooks.find(
            (b) => b.book.toString() === bookId && b.status === 'issued'
        );
        if (alreadyIssued) {
            return res.status(400).json({ message: 'Student already has this book issued' });
        }

        const issueDate = new Date();
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const formattedDueDate = dueDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

        // Update book
        book.available -= 1;
        book.issuedTo.push({ user: student._id, issueDate, dueDate });
        await book.save();

        // Update student
        student.borrowedBooks.push({ book: book._id, issueDate, dueDate, status: 'issued' });
        student.notifications.push({
            message: `Book "${book.title}" has been issued to you. Due date: ${formattedDueDate}.`,
            date: new Date(),
        });
        await student.save();

        res.json({ message: `"${book.title}" issued to ${student.name}`, book });
    } catch (error) {
        res.status(500).json({ message: 'Error issuing book', error: error.message });
    }
});

// ── POST /api/books/return-book — Return a book ─────────────
router.post('/return-book', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { bookId, studentId } = req.body;

        if (!bookId || !studentId) {
            return res.status(400).json({ message: 'Book ID and Student ID are required' });
        }

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        const student = await User.findOne({ userId: studentId, role: 'student' });
        if (!student) return res.status(404).json({ message: 'Student not found with that Register Number' });

        // Remove from book's issuedTo
        const issueIndex = book.issuedTo.findIndex(
            (entry) => entry.user.toString() === student._id.toString()
        );
        if (issueIndex === -1) {
            return res.status(400).json({ message: 'This book is not currently issued to this student' });
        }
        book.issuedTo.splice(issueIndex, 1);
        book.available += 1;
        await book.save();

        // Update student's borrowedBooks status
        const borrowEntry = student.borrowedBooks.find(
            (b) => b.book.toString() === bookId && b.status === 'issued'
        );
        if (borrowEntry) {
            borrowEntry.status = 'returned';
            borrowEntry.returnDate = new Date();

            const due = new Date(borrowEntry.dueDate);
            const now = new Date();
            if (now > due) {
                const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
                const fine = diffDays * 5;
                if (fine > 0) {
                    borrowEntry.fine = fine;
                    student.fineBalance += fine;
                    student.notifications.push({
                        message: `Returned "${book.title}" late. Fine: ₹${fine}.`,
                        date: new Date()
                    });
                }
            }
        }
        await student.save();

        res.json({ message: `"${book.title}" returned by ${student.name}`, book });
    } catch (error) {
        res.status(500).json({ message: 'Error returning book', error: error.message });
    }
});

// ── GET /api/books/my-books — Student's borrowed books ──────
router.get('/my-books', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('borrowedBooks.book');
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json(user.borrowedBooks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching borrowed books', error: error.message });
    }
});

// ── GET /api/books/students — All students (librarian only) ─
router.get('/students', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('-password')
            .populate('borrowedBooks.book');
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching students', error: error.message });
    }
});

// ── GET /api/books/reports/monthly — Monthly Report ─────────
router.get('/reports/monthly', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const m = parseInt(month); // 1-12
        const y = parseInt(year);

        // Start and end of the requested month
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59, 999);

        const students = await User.find({ role: 'student' })
            .select('-password')
            .populate('borrowedBooks.book');

        const departments = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'];

        let totalIssued = 0;
        let totalReturned = 0;
        let totalFine = 0;

        const deptSummary = {};
        departments.forEach(d => {
            deptSummary[d] = { issued: 0, returned: 0, fine: 0 };
        });

        const studentDetails = [];

        students.forEach(student => {
            let sIssued = 0;
            let sReturned = 0;
            let sFinePaid = 0;

            const dept = student.department || 'Other';
            const deptKey = departments.includes(dept) ? dept : 'Other';

            student.borrowedBooks.forEach(b => {
                const issueDate = new Date(b.issueDate);
                const returnDate = b.returnDate ? new Date(b.returnDate) : null;

                // Count as issued in this month if issueDate falls in month
                if (issueDate >= startDate && issueDate <= endDate) {
                    totalIssued++;
                    sIssued++;
                    if (deptSummary[deptKey]) deptSummary[deptKey].issued++;
                }

                // Count as returned in this month if returnDate falls in month
                if (b.status === 'returned' && returnDate && returnDate >= startDate && returnDate <= endDate) {
                    totalReturned++;
                    sReturned++;
                    if (b.fine > 0) {
                        totalFine += b.fine;
                        sFinePaid += b.fine;
                        if (deptSummary[deptKey]) deptSummary[deptKey].fine += b.fine;
                    }
                    if (deptSummary[deptKey]) deptSummary[deptKey].returned++;
                }
            });

            if (sIssued > 0 || sReturned > 0) {
                studentDetails.push({
                    name: student.name,
                    userId: student.userId,
                    department: student.department || '—',
                    booksIssued: sIssued,
                    booksReturned: sReturned,
                    finePaid: sFinePaid,
                });
            }
        });

        res.json({
            month: m,
            year: y,
            summary: {
                totalIssued,
                totalReturned,
                totalFine,
            },
            departmentWise: deptSummary,
            studentDetails,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating report', error: error.message });
    }
});

// ── POST /api/books/reserve — Request a book reservation ────
router.post('/reserve', protect, roleGuard('student'), async (req, res) => {
    try {
        const { bookId, reservationStartDate, reservationEndDate } = req.body;
        const studentId = req.user._id;

        if (!bookId) {
            return res.status(400).json({ message: 'Book ID is required' });
        }
        if (!reservationStartDate || !reservationEndDate) {
            return res.status(400).json({ message: 'Reservation start and end dates are required' });
        }

        const start = new Date(reservationStartDate);
        const end = new Date(reservationEndDate);
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 89) { // approx 3 months
            return res.status(400).json({ message: 'Minimum reservation duration is 3 months' });
        }
        if (diffDays > 185) { // approx 6 months
            return res.status(400).json({ message: 'Maximum reservation duration is 1 semester (6 months)' });
        }

        // check fine
        const student = await User.findById(studentId);
        if (student.fineBalance > 0) {
            return res.status(400).json({ message: 'Pay your pending fine before reserving.' });
        }

        // check limits
        if (student.borrowedBooks.filter(b => b.status === 'issued').length >= 3) {
            return res.status(400).json({ message: 'Borrow limit reached. Return a book first.' });
        }

        // check if already reserved or pending
        const existingRes = await Reservation.findOne({ student: studentId, book: bookId, status: { $in: ['pending', 'approved'] } });
        if (existingRes) {
            return res.status(400).json({ message: 'You already have an active reservation for this book.' });
        }

        // check if already issued
        const alreadyIssued = student.borrowedBooks.find(b => b.book.toString() === bookId && b.status === 'issued');
        if (alreadyIssued) {
            return res.status(400).json({ message: 'You already have this book issued.' });
        }

        const reservation = await Reservation.create({
            student: studentId,
            book: bookId,
            reservationStartDate: start,
            reservationEndDate: end
        });
        res.status(201).json({ message: 'Reservation request submitted successfully.', reservation });
    } catch (error) {
        res.status(500).json({ message: 'Error reserving book', error: error.message });
    }
});

// ── GET /api/books/reservations — Get reservations ──────────
router.get('/reservations', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'student') {
            query.student = req.user._id;
        }
        const reservations = await Reservation.find(query)
            .populate('student', 'name userId department')
            .populate('book', 'title author department isbn')
            .sort({ reservedAt: -1 });
        res.json(reservations);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reservations', error: error.message });
    }
});

// ── PUT /api/books/reservations/:id — Update reservation status ─
router.put('/reservations/:id', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { status } = req.body; // 'approved', 'rejected'
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        if (reservation.status !== 'pending') {
            return res.status(400).json({ message: `Reservation is already ${reservation.status}` });
        }

        reservation.status = status;

        if (status === 'approved') {
            // Auto-issue logic
            const book = await Book.findById(reservation.book);
            if (!book) return res.status(404).json({ message: 'Book not found' });

            if (book.available <= 0) {
                return res.status(400).json({ message: 'No copies available to fulfill this reservation' });
            }

            const student = await User.findById(reservation.student);
            if (!student) return res.status(404).json({ message: 'Student not found' });

            // Check limits again
            const activeIssues = student.borrowedBooks.filter(b => b.status === 'issued').length;
            if (activeIssues >= 3) {
                return res.status(400).json({ message: 'Student has reached the borrow limit (3 books)' });
            }

            const issueDate = new Date();
            const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            const formattedDueDate = dueDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

            // Update book
            book.available -= 1;
            book.issuedTo.push({ user: student._id, issueDate, dueDate });
            await book.save();

            // Update student
            student.borrowedBooks.push({ book: book._id, issueDate, dueDate, status: 'issued' });
            student.notifications.push({
                message: `Your reservation for "${book.title}" was approved and the book has been issued to you. Due date: ${formattedDueDate}.`,
                date: new Date()
            });
            await student.save();

            // Update reservation
            reservation.status = 'completed';
            reservation.issuedAt = issueDate;
            await reservation.save();

            return res.json({ message: `Reservation approved and "${book.title}" issued to ${student.name}`, reservation });
        } else {
            // Rejected
            await reservation.save();
            const student = await User.findById(reservation.student);
            const book = await Book.findById(reservation.book);
            if (student && book) {
                student.notifications.push({
                    message: `Your reservation for "${book.title}" was rejected.`,
                    date: new Date()
                });
                await student.save();
            }
            return res.json({ message: 'Reservation rejected', reservation });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating reservation', error: error.message });
    }
});

// ── POST /api/books/reservations/:id/issue — Issue from reservation ─
router.post('/reservations/:id/issue', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const reservation = await Reservation.findById(req.params.id)
            .populate('student')
            .populate('book');

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        if (reservation.status !== 'approved') {
            return res.status(400).json({ message: 'Reservation must be approved before issuing' });
        }

        const book = await Book.findById(reservation.book._id);
        if (!book) return res.status(404).json({ message: 'Book not found' });

        if (book.available <= 0) {
            return res.status(400).json({ message: 'No copies available for issue' });
        }

        const student = await User.findById(reservation.student._id);
        if (!student) return res.status(404).json({ message: 'Student not found' });

        if (student.fineBalance > 0) {
            return res.status(400).json({ message: 'Student has unpaid fines. Cannot issue book.' });
        }

        const activeIssues = student.borrowedBooks.filter(b => b.status === 'issued').length;
        if (activeIssues >= 3) {
            return res.status(400).json({ message: 'Student borrow limit of 3 books reached.' });
        }

        // Check if already issued
        const alreadyIssued = student.borrowedBooks.find(
            b => b.book.toString() === book._id.toString() && b.status === 'issued'
        );
        if (alreadyIssued) {
            return res.status(400).json({ message: 'Student already has this book issued.' });
        }

        const issueDate = new Date();
        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const formattedDueDate = dueDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

        // Update book availability
        book.available -= 1;
        book.issuedTo.push({ user: student._id, issueDate, dueDate });
        await book.save();

        // Update student borrowedBooks
        student.borrowedBooks.push({ book: book._id, issueDate, dueDate, status: 'issued' });
        student.notifications.push({
            message: `Book "${book.title}" has been issued to you (from reservation). Due date: ${formattedDueDate}.`,
            date: new Date(),
        });
        await student.save();

        // Mark reservation as completed
        reservation.status = 'completed';
        reservation.issuedAt = issueDate;
        await reservation.save();

        res.json({ message: `"${book.title}" issued to ${student.name} from reservation.` });
    } catch (error) {
        res.status(500).json({ message: 'Error issuing from reservation', error: error.message });
    }
});

// ── GET /api/books/reports/download — Download PDF Report ────
router.get('/reports/download', protect, roleGuard('librarian'), async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year are required' });
        }

        const m = parseInt(month);
        const y = parseInt(year);

        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0, 23, 59, 59, 999);

        const students = await User.find({ role: 'student' })
            .select('-password')
            .populate('borrowedBooks.book');

        const departments = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'];

        let totalIssued = 0;
        let totalReturned = 0;
        let totalFine = 0;

        const deptSummary = {};
        departments.forEach(d => { deptSummary[d] = { issued: 0, returned: 0, fine: 0 }; });

        const studentDetails = [];

        students.forEach(student => {
            let sIssued = 0;
            let sReturned = 0;
            let sFinePaid = 0;

            const dept = student.department || 'Other';
            const deptKey = departments.includes(dept) ? dept : 'Other';

            student.borrowedBooks.forEach(b => {
                const issueDate = new Date(b.issueDate);
                const returnDate = b.returnDate ? new Date(b.returnDate) : null;

                if (issueDate >= startDate && issueDate <= endDate) {
                    totalIssued++;
                    sIssued++;
                    if (deptSummary[deptKey]) deptSummary[deptKey].issued++;
                }

                if (b.status === 'returned' && returnDate && returnDate >= startDate && returnDate <= endDate) {
                    totalReturned++;
                    sReturned++;
                    if (b.fine > 0) {
                        totalFine += b.fine;
                        sFinePaid += b.fine;
                        if (deptSummary[deptKey]) deptSummary[deptKey].fine += b.fine;
                    }
                    if (deptSummary[deptKey]) deptSummary[deptKey].returned++;
                }
            });

            if (sIssued > 0 || sReturned > 0) {
                studentDetails.push({
                    name: student.name,
                    userId: student.userId,
                    department: student.department || '—',
                    booksIssued: sIssued,
                    booksReturned: sReturned,
                    finePaid: sFinePaid,
                });
            }
        });

        // ── Build PDF ──────────────────────────────────────────
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Book_Bank_Report_${monthNames[m]}_${y}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold')
            .text('Book Bank Management System', { align: 'center' });
        doc.fontSize(14).font('Helvetica')
            .text(`Monthly Report — ${monthNames[m]} ${y}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Overall Summary
        doc.fontSize(13).font('Helvetica-Bold').text('Overall Summary');
        doc.moveDown(0.4);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Books Issued   : ${totalIssued}`);
        doc.text(`Total Books Returned : ${totalReturned}`);
        doc.text(`Total Fine Collected : Rs.${totalFine}`);
        doc.moveDown(1);

        // Department-wise table
        doc.fontSize(13).font('Helvetica-Bold').text('Department-wise Summary');
        doc.moveDown(0.4);

        const deptHeaders = ['Department', 'Issued', 'Returned', 'Fine (Rs.)'];
        const deptColWidths = [150, 80, 80, 100];
        drawTableHeader(doc, deptHeaders, deptColWidths);

        departments.forEach(dept => {
            const row = deptSummary[dept];
            drawTableRow(doc, [dept, String(row.issued), String(row.returned), `Rs.${row.fine}`], deptColWidths);
        });

        doc.moveDown(1);

        // Student-wise table
        doc.fontSize(13).font('Helvetica-Bold').text('Student-wise Details');
        doc.moveDown(0.4);

        if (studentDetails.length === 0) {
            doc.fontSize(11).font('Helvetica').text('No student activity recorded for this month.');
        } else {
            const stuHeaders = ['Name', 'Register No', 'Dept', 'Issued', 'Returned', 'Fine'];
            const stuColWidths = [110, 80, 70, 50, 60, 60];
            drawTableHeader(doc, stuHeaders, stuColWidths);

            studentDetails.forEach(s => {
                drawTableRow(doc, [
                    s.name, s.userId, s.department,
                    String(s.booksIssued), String(s.booksReturned), `Rs.${s.finePaid}`
                ], stuColWidths);
            });
        }

        doc.moveDown(1.5);
        doc.fontSize(9).font('Helvetica')
            .text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'right' });

        doc.end();
    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating PDF report', error: error.message });
        }
    }
});

// ── PDF Table Helpers ─────────────────────────────────────────
function drawTableHeader(doc, headers, colWidths) {
    const x = 50;
    let curX = x;
    const rowHeight = 20;
    const y = doc.y;

    doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#333333');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');

    headers.forEach((h, i) => {
        doc.text(h, curX + 4, y + 5, { width: colWidths[i] - 8, lineBreak: false });
        curX += colWidths[i];
    });

    doc.fillColor('black');
    doc.y = y + rowHeight + 2;
}

function drawTableRow(doc, cells, colWidths, rowIndex = 0) {
    const x = 50;
    let curX = x;
    const rowHeight = 18;
    const y = doc.y;
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    // Light alternate row shading
    if (rowIndex % 2 === 0) {
        doc.rect(x, y, totalWidth, rowHeight).fill('#f5f5f5');
    }

    doc.fillColor('black').fontSize(9).font('Helvetica');

    cells.forEach((cell, i) => {
        doc.text(cell || '—', curX + 4, y + 4, { width: colWidths[i] - 8, lineBreak: false });
        curX += colWidths[i];
    });

    // Border
    doc.rect(x, y, totalWidth, rowHeight).stroke('#cccccc');

    doc.y = y + rowHeight;
}

module.exports = router;

