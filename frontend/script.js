// =============================================================
//  Book Bank Management System — Frontend Logic
//  Handles: Authentication · Student Dashboard · Librarian Dashboard
// =============================================================

const API_BASE = '/api';

// ── Utility: Get stored auth data ────────────────────────────
function getUser() {
    return JSON.parse(localStorage.getItem('bookbank_user') || 'null');
}

function getToken() {
    return localStorage.getItem('bookbank_token') || '';
}

// ── Utility: Authenticated fetch wrapper ─────────────────────
async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    if (!token && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        console.warn('apiFetch: No token found. Redirecting to login.');
        logout();
        throw new Error('Please log in to continue.');
    }
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...options,
    };
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) {
        // Specifically handle 403 Access Denied to help debugging
        if (res.status === 403) {
            console.error('ACCESS DENIED:', data.message);
            const user = getUser();
            console.log('Current local user role:', user ? user.role : 'none');
        }
        throw new Error(data.message || 'Request failed');
    }
    return data;
}

// ── Utility: Show an alert ───────────────────────────────────
function showAlert(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.className = `alert show alert-${type}`;
    el.textContent = message;
    if (type === 'success') {
        setTimeout(() => { el.classList.remove('show'); }, 3000);
    }
}

// ── Utility: Format date ─────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Utility: Check if date is past ───────────────────────────
function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
}

// =============================================================
//  AUTH PAGE — Login & Register (index.html)
// =============================================================

// ── Tab Switching ────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.auth-form').forEach((form) => {
        form.classList.remove('active');
    });
    const targetForm = document.getElementById(tab === 'login' ? 'loginForm' : 'registerForm');
    if (targetForm) targetForm.classList.add('active');
    const alert = document.getElementById('authAlert');
    if (alert) alert.classList.remove('show');
}

// ── Handle Login ─────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById('loginFullName') ? document.getElementById('loginFullName').value.trim() : '';
    const userId = document.getElementById('loginUserId').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!userId || !password) {
        return showAlert('authAlert', 'Please fill in Register Number and Password');
    }

    // For librarian login, skip Name check
    const isAdminLogin = userId === 'admin';

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';

    try {
        const payload = { userId, password };
        // Only send name for student login (not for admin)
        if (name && !isAdminLogin) payload.name = name;

        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        localStorage.setItem('bookbank_user', JSON.stringify(data.user));
        localStorage.setItem('bookbank_token', data.token);

        showAlert('authAlert', 'Login successful! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = data.user.role === 'librarian' ? 'librarian.html' : 'student.html';
        }, 800);
    } catch (err) {
        showAlert('authAlert', err.message);
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

// ── Handle Register ──────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail') ? document.getElementById('regEmail').value.trim() : '';
    const userId = document.getElementById('regUserId').value.trim();
    const password = document.getElementById('regPassword').value;
    const department = document.getElementById('regDepartment').value.trim();

    if (!name || !userId || !password || !department) {
        return showAlert('authAlert', 'Please fill in all required fields');
    }

    if (password.length < 6) {
        return showAlert('authAlert', 'Password must be at least 6 characters');
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account...';

    try {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, userId, password, department }),
        });

        localStorage.setItem('bookbank_user', JSON.stringify(data.user));
        localStorage.setItem('bookbank_token', data.token);

        showAlert('authAlert', 'Registration successful! Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = data.user.role === 'librarian' ? 'librarian.html' : 'student.html';
        }, 800);
    } catch (err) {
        showAlert('authAlert', err.message);
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

// ── Handle Reset Password ────────────────────────────────────
async function handleResetPassword(e) {
    e.preventDefault();
    const userId = document.getElementById('resetUserId').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value;
    const confirmPassword = document.getElementById('resetConfirmPassword').value;

    if (!userId || !newPassword || !confirmPassword) {
        return showAlert('resetAlert', 'Please fill in all fields');
    }

    if (newPassword !== confirmPassword) {
        return showAlert('resetAlert', 'Passwords do not match');
    }

    if (newPassword.length < 6) {
        return showAlert('resetAlert', 'Password must be at least 6 characters');
    }

    const btn = document.getElementById('resetBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Resetting...';

    try {
        const data = await apiFetch('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ userId, newPassword }),
        });

        showAlert('resetAlert', 'Password reset successful! Redirecting to login...', 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (err) {
        showAlert('resetAlert', err.message);
        btn.disabled = false;
        btn.textContent = 'Reset Password';
    }
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('bookbank_user');
    localStorage.removeItem('bookbank_token');
    window.location.href = 'index.html';
}

// ── Auto-redirect if already logged in (for index.html) ─────
function checkAutoRedirect() {
    const user = getUser();
    if (user && getToken()) {
        window.location.href = user.role === 'librarian' ? 'librarian.html' : 'student.html';
    }
}

if (document.getElementById('loginForm') && document.getElementById('registerForm')) {
    checkAutoRedirect();
}

// =============================================================
//  STUDENT DASHBOARD (student.html)
// =============================================================

async function initStudentDashboard() {
    const localUser = getUser();
    if (!localUser) return;

    try {
        const user = await apiFetch('/auth/me');
        localStorage.setItem('bookbank_user', JSON.stringify({
            ...localUser,
            name: user.name,
            department: user.department,
            role: user.role
        }));

        const avatarEl = document.getElementById('userAvatar');
        const nameEl = document.getElementById('userName');
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
        if (nameEl) nameEl.textContent = user.name;

        const profileNameEl = document.getElementById('profileName');
        const profileIdEl = document.getElementById('profileId');
        const profileDeptEl = document.getElementById('profileDept');
        if (profileNameEl) profileNameEl.textContent = user.name;
        if (profileIdEl) profileIdEl.textContent = user.userId;
        if (profileDeptEl) profileDeptEl.textContent = user.department || 'Not specified';

        const fineEl = document.getElementById('fineBalance');
        const payBtn = document.getElementById('payFineBtn');
        if (fineEl) fineEl.textContent = `₹${user.fineBalance}`;
        if (payBtn) payBtn.style.display = user.fineBalance > 0 ? 'block' : 'none';

        await loadStudentDashboardStats(user);
        populateNotifications(user);
        renderStudentBooks(user.borrowedBooks);
        await loadReservations();
    } catch (err) {
        console.error('Error initializing student dashboard:', err);
        // If profile fetch fails (e.g. user deleted or token expired), log out
        logout();
    }
}

// ── Dashboard Stats (Dynamic) ────────────────────────────────
async function loadStudentDashboardStats(user) {
    try {
        const books = await apiFetch('/books');
        let availableCount = 0;
        books.forEach(b => availableCount += b.available);

        let issuedCount = 0;
        let dueSoonCount = 0;
        const now = new Date();

        user.borrowedBooks.forEach(b => {
            if (b.status === 'issued') {
                issuedCount++;
                const due = new Date(b.dueDate);
                const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                if (diffDays <= 3 && diffDays >= 0) dueSoonCount++;
            }
        });

        const avEl = document.getElementById('availableBooksCount');
        const brEl = document.getElementById('borrowedCount');
        const dsEl = document.getElementById('dueSoonCount');

        if (avEl) avEl.textContent = availableCount;
        if (brEl) brEl.textContent = issuedCount;
        if (dsEl) dsEl.textContent = dueSoonCount;
    } catch (err) {
        console.error('Error loading dynamic stats:', err);
    }
}

// ── Render Student's Borrowed Books (Active & History) ───────
function renderStudentBooks(borrowedBooks) {
    const activeTbody = document.getElementById('myBooksBody');
    const activeTable = document.getElementById('myBooksTable');
    const activeEmpty = document.getElementById('myBooksEmpty');

    const historyTbody = document.getElementById('historyBody');
    const historyTable = document.getElementById('historyTable');
    const historyEmpty = document.getElementById('historyEmpty');

    if (!activeTbody || !historyTbody) return;

    const activeBooks = [];
    const historyBooks = [];

    borrowedBooks.forEach(entry => {
        if (entry.status === 'issued') {
            activeBooks.push(entry);
        } else {
            historyBooks.push(entry);
        }
    });

    // Render Active
    if (activeBooks.length === 0) {
        activeTable.style.display = 'none';
        activeEmpty.style.display = 'block';
    } else {
        activeTable.style.display = 'table';
        activeEmpty.style.display = 'none';
        activeTbody.innerHTML = activeBooks.map(entry => {
            const title = entry.book ? entry.book.title : 'Unknown';
            const author = entry.book ? entry.book.author : '—';
            const overdue = isOverdue(entry.dueDate);
            const badgeClass = overdue ? 'badge-overdue' : 'badge-issued';
            const badgeText = overdue ? 'Overdue' : 'Issued';

            return `<tr>
                <td>${title}</td>
                <td>${author}</td>
                <td>${formatDate(entry.issueDate)}</td>
                <td>${formatDate(entry.dueDate)}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            </tr>`;
        }).join('');
    }

    // Render History
    if (historyBooks.length === 0) {
        historyTable.style.display = 'none';
        historyEmpty.style.display = 'block';
    } else {
        historyTable.style.display = 'table';
        historyEmpty.style.display = 'none';
        historyTbody.innerHTML = historyBooks.map(entry => {
            const title = entry.book ? entry.book.title : 'Unknown';
            const author = entry.book ? entry.book.author : '—';
            const finePaidText = entry.fine > 0 ? (entry.finePaid ? `₹${entry.fine} (Paid)` : `₹${entry.fine} (Unpaid)`) : 'None';

            return `<tr>
                <td>${title}</td>
                <td>${author}</td>
                <td>${formatDate(entry.issueDate)}</td>
                <td>${formatDate(entry.returnDate)}</td>
                <td><span class="badge ${entry.fine > 0 && !entry.finePaid ? 'badge-overdue' : 'badge-available'}">${finePaidText}</span></td>
            </tr>`;
        }).join('');
    }
}

// ── Notifications & Fine Payment ─────────────────────────────
function populateNotifications(user) {
    const badge = document.getElementById('bellBadge');
    const list = document.getElementById('notificationList');
    if (!badge || !list) return;

    const notes = [...user.notifications];

    user.borrowedBooks.forEach(b => {
        if (b.status === 'issued') {
            const due = new Date(b.dueDate);
            const now = new Date();
            const diffDays = (due - now) / (1000 * 60 * 60 * 24);
            if (diffDays > 0 && diffDays <= 1) {
                notes.push({ message: `Reminder: "${b.book ? b.book.title : 'Book'}" is due tomorrow!`, date: new Date(), unread: true });
            } else if (diffDays < 0) {
                notes.push({ message: `OVERDUE: "${b.book ? b.book.title : 'Book'}" is overdue!`, date: new Date(), unread: true });
            }
        }
    });

    notes.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (notes.length === 0) {
        list.innerHTML = '<li>No notifications</li>';
        badge.style.display = 'none';
    } else {
        badge.textContent = notes.length > 9 ? '9+' : notes.length;
        badge.style.display = 'inline-block';
        list.innerHTML = notes.map(n => `<li class="${n.unread === false ? '' : 'unread'}">
            <div style="font-size:0.75rem; color:#888;">${formatDate(n.date)}</div>
            ${n.message}
        </li>`).join('');
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
}

async function payFine() {
    try {
        const data = await apiFetch('/auth/pay-fine', { method: 'POST' });
        alert(data.message);
        initStudentDashboard();
    } catch (err) {
        alert(err.message);
    }
}

// ── Reservations (Student) ───────────────────────────────────
async function loadReservations() {
    try {
        const resList = await apiFetch('/books/reservations');

        const tbody = document.getElementById('reservationBody');
        const table = document.getElementById('reservationTable');
        const empty = document.getElementById('reservationEmpty');

        if (!tbody) return;

        if (resList.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
        } else {
            table.style.display = 'table';
            empty.style.display = 'none';
            tbody.innerHTML = resList.map(r => {
                const title = r.book ? r.book.title : 'Unknown';
                const author = r.book ? r.book.author : '—';
                const s = r.status;
                let badgeClass = 'badge-issued';
                if (s === 'approved') badgeClass = 'badge-available';
                if (s === 'rejected') badgeClass = 'badge-unavailable';
                if (s === 'completed') badgeClass = 'badge-returned';

                return `<tr>
                    <td>${title}</td>
                    <td>${author}</td>
                    <td>${formatDate(r.reservationStartDate)}</td>
                    <td>${formatDate(r.reservationEndDate)}</td>
                    <td><span class="badge ${badgeClass}">${s.toUpperCase()}</span></td>
                    <td>${formatDate(r.issuedAt)}</td>
                </tr>`;
            }).join('');

            const reservedEl = document.getElementById('reservedCount');
            if (reservedEl) reservedEl.textContent = resList.filter(r => r.status === 'pending' || r.status === 'approved').length;
        }
    } catch (err) {
        console.error('Error loading reservations:', err);
    }
}

function openReserveModal(bookId) {
    document.getElementById('reserveBookId').value = bookId;
    document.getElementById('reserveStartDate').value = '';
    document.getElementById('reserveEndDate').value = '';
    const alertEl = document.getElementById('reserveAlert');
    if (alertEl) alertEl.classList.remove('show');
    document.getElementById('reserveModal').classList.add('show');
}

function closeReserveModal() {
    document.getElementById('reserveModal').classList.remove('show');
}

async function handleReserveBook(e) {
    e.preventDefault();
    const bookId = document.getElementById('reserveBookId').value;
    const reservationStartDate = document.getElementById('reserveStartDate').value;
    const reservationEndDate = document.getElementById('reserveEndDate').value;

    if (!bookId || !reservationStartDate || !reservationEndDate) {
        return showAlert('reserveAlert', 'Please fill in all reservation fields');
    }

    const btn = document.getElementById('reserveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Reserving...';

    try {
        const data = await apiFetch('/books/reserve', {
            method: 'POST',
            body: JSON.stringify({ bookId, reservationStartDate, reservationEndDate })
        });
        showAlert('reserveAlert', data.message, 'success');
        setTimeout(() => {
            closeReserveModal();
            initStudentDashboard();
            searchBooks();
        }, 1500);
    } catch (err) {
        showAlert('reserveAlert', err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Reservation';
    }
}

// ── Search Books (Student) ───────────────────────────────────
async function searchBooks() {
    const query = document.getElementById('searchInput') ? document.getElementById('searchInput').value.trim() : '';
    try {
        const books = await apiFetch(`/books?search=${encodeURIComponent(query)}`);
        const tbody = document.getElementById('searchResults');
        const table = document.getElementById('searchResultsTable');
        const empty = document.getElementById('searchEmpty');

        if (books.length === 0) {
            if (table) table.style.display = 'none';
            if (empty) empty.style.display = 'block';
        } else {
            if (table) table.style.display = 'table';
            if (empty) empty.style.display = 'none';

            tbody.innerHTML = books
                .map((book) => {
                    const isAvailable = book.available > 0;
                    return `<tr>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>${book.department || '—'}</td>
            <td>${book.isbn}</td>
            <td>${book.available} / ${book.quantity}</td>
            <td><span class="badge ${isAvailable ? 'badge-available' : 'badge-unavailable'}">
              ${isAvailable ? 'Available' : 'Unavailable'}
            </span></td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="openReserveModal('${book._id}')">Reserve</button>
            </td>
          </tr>`;
                })
                .join('');
        }
    } catch (err) {
        console.error('Search error:', err);
    }
}

function handleSearchKeyup(e) {
    if (e.key === 'Enter') searchBooks();
}

// ── Scroll to Section ────────────────────────────────────────
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================
//  LIBRARIAN DASHBOARD (librarian.html)
// =============================================================

let allBooksCache = [];

async function initLibrarianDashboard() {
    await loadDashboardStats();
    loadInventory();
    loadStudents();
    populateBookDropdowns();
    loadLibReservations();
    loadIssuedBooks();
    // Pre-set current month/year in report section
    const now = new Date();
    const monthEl = document.getElementById('reportMonth');
    const yearEl = document.getElementById('reportYear');
    if (monthEl) monthEl.value = now.getMonth() + 1;
    if (yearEl) yearEl.value = now.getFullYear();
}

// ── Sidebar Navigation ──────────────────────────────────────
function switchSection(key) {
    const sections = {
        dashboard: { sectionId: 'dashboardSection', navId: 'nav-dashboard' },
        inventory: { sectionId: 'inventorySection', navId: 'nav-inventory' },
        reservations: { sectionId: 'reservationsSection', navId: 'nav-reservations' },
        issueBooks: { sectionId: 'issueBooksSection', navId: 'nav-issueBooks' },
        students: { sectionId: 'studentsSection', navId: 'nav-students' },
        reports: { sectionId: 'reportsSection', navId: 'nav-reports' },
    };

    const config = sections[key];
    if (!config) {
        console.warn('switchSection: unknown key', key);
        return;
    }

    document.querySelectorAll('.sidebar-nav a').forEach((a) => a.classList.remove('active'));

    const navLink = document.getElementById(config.navId);
    if (navLink) navLink.classList.add('active');

    document.querySelectorAll('.lib-section').forEach((sec) => sec.classList.remove('active'));

    const target = document.getElementById(config.sectionId);
    if (target) target.classList.add('active');

    switch (key) {
        case 'dashboard': loadDashboardStats(); break;
        case 'inventory':
            loadDashboardStats().then(() => loadInventory());
            break;
        case 'students': loadStudents(); break;
        case 'issueBooks':
            populateBookDropdowns();
            loadIssuedBooks();
            break;
        case 'reservations': loadLibReservations(); break;
        case 'reports': break;
    }
}

// ── Dashboard Stats ──────────────────────────────────────────
async function loadDashboardStats() {
    try {
        const books = await apiFetch('/books');
        const students = await apiFetch('/books/students');

        allBooksCache = books;

        let totalBooks = 0;
        let issuedCount = 0;
        let availableCount = 0;

        books.forEach((b) => {
            totalBooks += b.quantity;
            issuedCount += b.quantity - b.available;
            availableCount += b.available;
        });

        const totalBooksEl = document.getElementById('totalBooks');
        const issuedBooksEl = document.getElementById('issuedBooks');
        const availableBooksEl = document.getElementById('availableBooks');
        const totalStudentsEl = document.getElementById('totalStudents');

        if (totalBooksEl) totalBooksEl.textContent = totalBooks;
        if (issuedBooksEl) issuedBooksEl.textContent = issuedCount;
        if (availableBooksEl) availableBooksEl.textContent = availableCount;
        if (totalStudentsEl) totalStudentsEl.textContent = students.length;

        // Recent books table (dashboard)
        renderRecentBooksTable(books.slice(0, 5));
    } catch (err) {
        console.error('Error loading stats:', err);
        if (err.message.toLowerCase().includes('authorized') || err.message.toLowerCase().includes('not found')) {
            logout();
        }
    }
}

// ── Render Recent Books (Dashboard) ──────────────────────────
function renderRecentBooksTable(books) {
    const tbody = document.getElementById('recentBooksBody');
    const table = document.getElementById('recentBooksTable');
    const empty = document.getElementById('recentBooksEmpty');

    if (!tbody) return;

    if (books.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = books.map((book) => `<tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.department || '—'}</td>
        <td>${book.isbn}</td>
        <td>${book.quantity}</td>
        <td><span class="badge ${book.available > 0 ? 'badge-available' : 'badge-unavailable'}">${book.available}</span></td>
    </tr>`).join('');
}

// ── Load / Search Inventory ──────────────────────────────────
async function loadInventory() {
    try {
        const searchQuery = document.getElementById('libInventorySearch')?.value?.trim() || '';
        const books = await apiFetch(`/books?search=${encodeURIComponent(searchQuery)}`);
        allBooksCache = books;
        renderInventoryTable(books);
        populateBookDropdowns();
    } catch (err) {
        console.error('Error loading inventory:', err);
    }
}

function searchInventory() {
    const query = document.getElementById('libInventorySearch')?.value?.toLowerCase().trim() || '';
    const filtered = allBooksCache.filter(b =>
        (b.title || '').toLowerCase().includes(query) ||
        (b.author || '').toLowerCase().includes(query) ||
        (b.isbn || '').toLowerCase().includes(query) ||
        (b.department || '').toLowerCase().includes(query)
    );
    renderInventoryTable(filtered);
}

function renderInventoryTable(books) {
    const tbody = document.getElementById('inventoryBody');
    const table = document.getElementById('inventoryTable');
    const empty = document.getElementById('inventoryEmpty');

    if (!tbody) return;

    if (books.length === 0) {
        if (table) table.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = books.map((book) => `<tr>
        <td>${book.title}</td>
        <td>${book.author}</td>
        <td>${book.department || '—'}</td>
        <td>${book.isbn}</td>
        <td>${book.quantity}</td>
        <td><span class="badge ${book.available > 0 ? 'badge-available' : 'badge-unavailable'}">${book.available}</span></td>
        <td class="table-actions">
            <button class="btn-icon edit" title="Edit" onclick='openEditModal(${JSON.stringify(book)})'>✏️</button>
            <button class="btn-icon delete" title="Delete" onclick="deleteBook('${book._id}')">🗑️</button>
        </td>
    </tr>`).join('');
}

// ── Add Book ─────────────────────────────────────────────────
async function handleAddBook(e) {
    e.preventDefault();
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const isbn = document.getElementById('bookIsbn').value.trim();
    const department = document.getElementById('bookDepartment').value;
    const quantity = parseInt(document.getElementById('bookQty').value) || 1;

    if (!title || !author || !isbn) {
        return showAlert('addBookAlert', 'Title, Author, and ISBN are required');
    }

    try {
        await apiFetch('/books', {
            method: 'POST',
            body: JSON.stringify({ title, author, isbn, department, quantity }),
        });
        showAlert('addBookAlert', 'Book added successfully!', 'success');
        document.getElementById('addBookForm').reset();
        loadInventory();
        loadDashboardStats();
    } catch (err) {
        showAlert('addBookAlert', err.message);
    }
}

// ── Edit Book Modal ──────────────────────────────────────────
function openEditModal(book) {
    document.getElementById('editBookId').value = book._id;
    document.getElementById('editTitle').value = book.title;
    document.getElementById('editAuthor').value = book.author;
    document.getElementById('editIsbn').value = book.isbn;
    document.getElementById('editDepartment').value = book.department || 'Other';
    document.getElementById('editQty').value = book.quantity;
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

async function handleEditBook(e) {
    e.preventDefault();
    const id = document.getElementById('editBookId').value;
    const title = document.getElementById('editTitle').value.trim();
    const author = document.getElementById('editAuthor').value.trim();
    const isbn = document.getElementById('editIsbn').value.trim();
    const department = document.getElementById('editDepartment').value;
    const quantity = parseInt(document.getElementById('editQty').value) || 1;

    try {
        await apiFetch(`/books/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ title, author, isbn, department, quantity }),
        });
        showAlert('addBookAlert', 'Book updated successfully!', 'success');
        closeEditModal();
        loadInventory();
        loadDashboardStats();
    } catch (err) {
        alert(err.message);
    }
}

// ── Delete Book ──────────────────────────────────────────────
async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    try {
        await apiFetch(`/books/${id}`, { method: 'DELETE' });
        showAlert('addBookAlert', 'Book deleted successfully!', 'success');
        loadInventory();
        loadDashboardStats();
    } catch (err) {
        alert(err.message);
    }
}

// ── Populate Book Dropdowns (Issue/Return) ───────────────────
async function populateBookDropdowns() {
    try {
        if (allBooksCache.length === 0) {
            allBooksCache = await apiFetch('/books');
        }

        const issueSelect = document.getElementById('issueBookId');
        const returnSelect = document.getElementById('returnBookId');

        if (issueSelect) {
            issueSelect.innerHTML = '<option value="">Select a book...</option>' +
                allBooksCache
                    .filter((b) => b.available > 0)
                    .map((b) => `<option value="${b._id}">${b.title} (${b.available} available)</option>`)
                    .join('');
        }

        if (returnSelect) {
            returnSelect.innerHTML = '<option value="">Select a book...</option>' +
                allBooksCache
                    .filter((b) => b.issuedTo && b.issuedTo.length > 0)
                    .map((b) => `<option value="${b._id}">${b.title}</option>`)
                    .join('');
        }
    } catch (err) {
        console.error('Error populating dropdowns:', err);
    }
}

// ── Issue Book ───────────────────────────────────────────────
async function handleIssueBook(e) {
    e.preventDefault();
    const bookId = document.getElementById('issueBookId').value;
    const studentId = document.getElementById('issueStudentId').value.trim();

    if (!bookId || !studentId) {
        return showAlert('issueAlert', 'Please select a book and enter a student Register Number');
    }

    try {
        const data = await apiFetch('/books/issue-book', {
            method: 'POST',
            body: JSON.stringify({ bookId, studentId }),
        });
        showAlert('issueAlert', data.message, 'success');
        document.getElementById('issueBookForm').reset();
        allBooksCache = [];
        populateBookDropdowns();
        loadIssuedBooks();
        loadDashboardStats();
    } catch (err) {
        showAlert('issueAlert', err.message);
    }
}

// ── Return Book ──────────────────────────────────────────────
async function handleReturnBook(e) {
    e.preventDefault();
    const bookId = document.getElementById('returnBookId').value;
    const studentId = document.getElementById('returnStudentId').value.trim();

    if (!bookId || !studentId) {
        return showAlert('returnAlert', 'Please select a book and enter a student Register Number');
    }

    try {
        const data = await apiFetch('/books/return-book', {
            method: 'POST',
            body: JSON.stringify({ bookId, studentId }),
        });
        showAlert('returnAlert', data.message, 'success');
        document.getElementById('returnBookForm').reset();
        allBooksCache = [];
        populateBookDropdowns();
        loadIssuedBooks();
        loadDashboardStats();
    } catch (err) {
        showAlert('returnAlert', err.message);
    }
}

// ── Load Students ────────────────────────────────────────────
async function loadStudents() {
    try {
        const students = await apiFetch('/books/students');
        const reservations = await apiFetch('/books/reservations');

        const tbody = document.getElementById('studentsBody');
        const table = document.getElementById('studentsTable');
        const empty = document.getElementById('studentsEmpty');

        if (!tbody) return;

        if (students.length === 0) {
            if (table) table.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (table) table.style.display = 'table';
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = students.map((s) => {
            // Get reservations for this student
            const studentReservations = reservations.filter(r =>
                r.student && (r.student._id === s._id || r.student.userId === s.userId) &&
                (r.status === 'pending' || r.status === 'approved')
            );

            const reservedCount = studentReservations.length;
            const reservedBooksDisplay = reservedCount > 0
                ? `<span style="font-weight:600;">${reservedCount} books</span> <button class="btn btn-sm btn-outline" style="padding: 2px 8px; font-size: 0.75rem;" onclick="openStudentBooksModal('${s.userId}', 'reserved')">View</button>`
                : '<span style="color:var(--text-muted);">None</span>';

            // Get actively issued books
            const borrowedActive = s.borrowedBooks
                ? s.borrowedBooks.filter((b) => b.status === 'issued')
                : [];

            const borrowedCount = borrowedActive.length;
            const borrowedBooksDisplay = borrowedCount > 0
                ? `<span style="font-weight:600;">${borrowedCount} books</span> <button class="btn btn-sm btn-outline" style="padding: 2px 8px; font-size: 0.75rem;" onclick="openStudentBooksModal('${s.userId}', 'borrowed')">View</button>`
                : '<span style="color:var(--text-muted);">None</span>';

            return `<tr>
                <td>${s.name}</td>
                <td>${s.userId}</td>
                <td>${s.department || '—'}</td>
                <td style="font-size:0.85rem;">${reservedBooksDisplay}</td>
                <td style="font-size:0.85rem;">${borrowedBooksDisplay}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('Error loading students:', err);
    }
}

// ── Student Book Details Modal ───────────────────────────────
async function openStudentBooksModal(userId, type) {
    try {
        const students = await apiFetch('/books/students');
        const reservations = await apiFetch('/books/reservations');
        const s = students.find(student => student.userId === userId);
        if (!s) return;

        const modal = document.getElementById('studentBooksModal');
        const title = document.getElementById('studentBooksTitle');
        const header = document.getElementById('studentBooksHeader');
        const body = document.getElementById('studentBooksBody');

        if (type === 'reserved') {
            title.textContent = `🎟️ Reserved Books — ${s.name}`;
            header.innerHTML = `
                <th>Book Title</th>
                <th>Author</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
            `;
            const studentReservations = reservations.filter(r =>
                r.student && (r.student._id === s._id || r.student.userId === s.userId) &&
                (r.status === 'pending' || r.status === 'approved')
            );

            body.innerHTML = studentReservations.map(r => `
                <tr>
                    <td>${r.book ? r.book.title : '—'}</td>
                    <td>${r.book ? r.book.author : '—'}</td>
                    <td>${formatDate(r.reservationStartDate)}</td>
                    <td>${formatDate(r.reservationEndDate)}</td>
                    <td><span class="badge ${r.status === 'approved' ? 'badge-available' : 'badge-issued'}">${r.status.toUpperCase()}</span></td>
                </tr>
            `).join('');
        } else {
            title.textContent = `📖 Borrowed Books — ${s.name}`;
            header.innerHTML = `
                <th>Book Title</th>
                <th>Author</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Fines</th>
            `;
            const borrowedActive = s.borrowedBooks.filter(b => b.status === 'issued');
            body.innerHTML = borrowedActive.map(b => {
                const now = new Date();
                const due = new Date(b.dueDate);
                let fine = 0;
                if (now > due) {
                    const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
                    fine = diffDays * 5;
                }
                return `
                <tr>
                    <td>${b.book ? b.book.title : '—'}</td>
                    <td>${b.book ? b.book.author : '—'}</td>
                    <td>${formatDate(b.issueDate)}</td>
                    <td>${formatDate(b.dueDate)}</td>
                    <td><span class="badge ${fine > 0 ? 'badge-overdue' : 'badge-available'}">${fine > 0 ? '₹' + fine : 'None'}</span></td>
                </tr>
            `}).join('');
        }

        modal.classList.add('show');
    } catch (err) {
        console.error('Error opening student books modal:', err);
    }
}

function closeStudentBooksModal() {
    document.getElementById('studentBooksModal').classList.remove('show');
}


// ── Load Librarian Issued Books ──────────────────────────────
async function loadIssuedBooks() {
    try {
        const students = await apiFetch('/books/students');
        const tbody = document.getElementById('issuedBooksBody');
        const table = document.getElementById('issuedBooksTable');
        const empty = document.getElementById('issuedBooksEmpty');

        if (!tbody) return;

        let issuedList = [];

        students.forEach(student => {
            student.borrowedBooks.forEach(b => {
                if (b.status === 'issued' && b.book) {
                    const overdue = isOverdue(b.dueDate);
                    const now = new Date();
                    const due = new Date(b.dueDate);
                    let fineAccrued = 0;
                    if (now > due) {
                        const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
                        fineAccrued = diffDays * 5;
                    }

                    issuedList.push({
                        studentName: student.name,
                        studentId: student.userId,
                        studentDept: student.department || '—',
                        bookTitle: b.book.title,
                        bookAuthor: b.book.author,
                        issueDate: b.issueDate,
                        dueDate: b.dueDate,
                        fine: fineAccrued,
                        overdue: overdue
                    });
                }
            });
        });

        issuedList.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (issuedList.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
        } else {
            table.style.display = 'table';
            empty.style.display = 'none';
            tbody.innerHTML = issuedList.map(item => {
                const fineText = item.fine > 0 ? `₹${item.fine}` : 'Clear';
                const fineClass = item.fine > 0 ? 'badge-overdue' : 'badge-available';

                return `<tr>
                      <td>${item.studentName}</td>
                      <td>${item.studentId}</td>
                      <td>${item.studentDept}</td>
                      <td>${item.bookTitle}</td>
                      <td>${formatDate(item.issueDate)}</td>
                      <td class="${item.overdue ? 'text-danger' : ''}">${formatDate(item.dueDate)}</td>
                      <td><span class="badge ${fineClass}">${fineText}</span></td>
                      <td><button class="btn btn-sm btn-outline" onclick="prefillReturn('${item.studentId}', '${item.bookTitle}')">Return</button></td>
                  </tr>`;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading issued books:', err);
    }
}

// ── Prefill Return Form ──────────────────────────────────────
function prefillReturn(studentId, bookTitle) {
    // Switch to issue section and prefill return form
    switchSection('issueBooks');
    const returnStudentId = document.getElementById('returnStudentId');
    if (returnStudentId) returnStudentId.value = studentId;
    // Find book in cache & select in dropdown
    const book = allBooksCache.find(b => b.title === bookTitle);
    if (book) {
        const returnSelect = document.getElementById('returnBookId');
        if (returnSelect) {
            // Make sure option exists
            const opt = returnSelect.querySelector(`option[value="${book._id}"]`);
            if (!opt) {
                const newOpt = document.createElement('option');
                newOpt.value = book._id;
                newOpt.textContent = book.title;
                returnSelect.appendChild(newOpt);
            }
            returnSelect.value = book._id;
        }
    }
    showAlert('returnAlert', `Ready to return "${bookTitle}" for student ${studentId}. Click Return Book to confirm.`, 'success');
}

// ── Load Librarian Reservations ──────────────────────────────
async function loadLibReservations() {
    try {
        const resList = await apiFetch('/books/reservations');

        const tbody = document.getElementById('libReservationsBody');
        const table = document.getElementById('libReservationsTable');
        const empty = document.getElementById('libReservationsEmpty');

        if (!tbody) return;

        if (resList.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
        } else {
            table.style.display = 'table';
            empty.style.display = 'none';

            tbody.innerHTML = resList.map(r => {
                const student = r.student || {};
                const book = r.book || {};
                let badgeClass = 'badge-issued';
                if (r.status === 'approved') badgeClass = 'badge-available';
                if (r.status === 'rejected') badgeClass = 'badge-unavailable';
                if (r.status === 'completed') badgeClass = 'badge-returned';

                let actions = '';
                if (r.status === 'pending') {
                    actions = `
                        <button class="btn btn-sm btn-primary" onclick="updateReservation('${r._id}', 'approved')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="updateReservation('${r._id}', 'rejected')">Reject</button>
                    `;
                } else if (r.status === 'approved') {
                    actions = `
                        <button class="btn btn-sm btn-primary" onclick="issueFromReservation('${r._id}')">📤 Issue Book</button>
                    `;
                }

                return `<tr>
                      <td>${student.name || 'Unknown'}</td>
                      <td>${student.userId || '—'}</td>
                      <td>${student.department || '—'}</td>
                      <td>${book.title || 'Unknown'}</td>
                      <td>${formatDate(r.reservationStartDate)}</td>
                      <td>${formatDate(r.reservationEndDate)}</td>
                      <td><span class="badge ${badgeClass}">${r.status.toUpperCase()}</span></td>
                      <td>${actions}</td>
                  </tr>`;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading reservations:', err);
    }
}

async function updateReservation(id, status) {
    if (!confirm(`Are you sure you want to ${status} this reservation?`)) return;
    try {
        const data = await apiFetch(`/books/reservations/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        showAlert('addBookAlert', data.message, 'success');
        // If approved, refresh all librarian views
        loadLibReservations();
        loadIssuedBooks();
        loadInventory();
        loadDashboardStats();
    } catch (err) {
        alert(err.message);
    }
}

// ── Issue From Reservation ───────────────────────────────────
async function issueFromReservation(reservationId) {
    if (!confirm('Issue this book to the student? This will mark the reservation as completed.')) return;
    try {
        const data = await apiFetch(`/books/reservations/${reservationId}/issue`, { method: 'POST' });
        alert(data.message);
        loadLibReservations();
        loadIssuedBooks();
        loadDashboardStats();
        allBooksCache = [];
        populateBookDropdowns();
    } catch (err) {
        alert(err.message);
    }
}

// =============================================================
//  REPORTS (Librarian Dashboard)
// =============================================================

async function generateMonthlyReport() {
    const month = document.getElementById('reportMonth').value;
    const year = document.getElementById('reportYear').value;

    if (!month || !year) {
        return showAlert('reportAlert', 'Please select month and year');
    }

    const btn = event ? event.target : null;

    showAlert('reportAlert', 'Generating report...', 'success');

    try {
        const data = await apiFetch(`/books/reports/monthly?month=${month}&year=${year}`);

        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        // Set title
        const titleEl = document.getElementById('reportTitle');
        if (titleEl) titleEl.textContent = `${monthNames[data.month]} ${data.year}`;

        // Overall summary
        const totalIssuedEl = document.getElementById('rTotalIssued');
        const totalReturnedEl = document.getElementById('rTotalReturned');
        const totalFineEl = document.getElementById('rTotalFine');
        if (totalIssuedEl) totalIssuedEl.textContent = data.summary.totalIssued;
        if (totalReturnedEl) totalReturnedEl.textContent = data.summary.totalReturned;
        if (totalFineEl) totalFineEl.textContent = `₹${data.summary.totalFine}`;

        // Department-wise
        const deptTbody = document.getElementById('reportDeptBody');
        if (deptTbody) {
            const depts = Object.entries(data.departmentWise);
            deptTbody.innerHTML = depts.map(([dept, info]) => `<tr>
                <td>${dept}</td>
                <td>${info.issued}</td>
                <td>${info.returned}</td>
                <td>₹${info.fine}</td>
            </tr>`).join('');
        }

        // Student-wise
        const studentTbody = document.getElementById('reportStudentBody');
        const studentTable = document.getElementById('reportStudentTable');
        const studentEmpty = document.getElementById('reportStudentEmpty');

        if (studentTbody) {
            if (data.studentDetails.length === 0) {
                if (studentTable) studentTable.style.display = 'none';
                if (studentEmpty) studentEmpty.style.display = 'block';
            } else {
                if (studentTable) studentTable.style.display = 'table';
                if (studentEmpty) studentEmpty.style.display = 'none';
                studentTbody.innerHTML = data.studentDetails.map(s => `<tr>
                    <td>${s.name}</td>
                    <td>${s.userId}</td>
                    <td>${s.department}</td>
                    <td>${s.booksIssued}</td>
                    <td>${s.booksReturned}</td>
                    <td>₹${s.finePaid}</td>
                </tr>`).join('');
            }
        }

        // Show report output
        const reportOutput = document.getElementById('reportOutput');
        if (reportOutput) reportOutput.style.display = 'block';

        showAlert('reportAlert', `Report generated for ${monthNames[data.month]} ${data.year}`, 'success');
    } catch (err) {
        showAlert('reportAlert', err.message);
    }
}

// ── Legacy alias (in case anything calls loadAllBooks) ───────
async function loadAllBooks() {
    return loadInventory();
}

// ── Download Monthly Report as PDF ───────────────────────────
async function downloadReport() {
    const month = document.getElementById('reportMonth') ? document.getElementById('reportMonth').value : '';
    const year = document.getElementById('reportYear') ? document.getElementById('reportYear').value : '';

    if (!month || !year) {
        return showAlert('reportAlert', 'Please select month and year before downloading');
    }

    showAlert('reportAlert', 'Preparing PDF download...', 'success');

    const token = getToken();
    try {
        const response = await fetch(`${API_BASE}/books/reports/download?month=${month}&year=${year}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to download report');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        const a = document.createElement('a');
        a.href = url;
        a.download = `Book_Bank_Report_${monthNames[parseInt(month)]}_${year}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showAlert('reportAlert', 'PDF downloaded successfully!', 'success');
    } catch (err) {
        showAlert('reportAlert', err.message);
    }
}

