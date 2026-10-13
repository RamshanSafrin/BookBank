const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
console.log('dueDate raw:', dueDate);
console.log('dueDate as stored in DB (ISO):', dueDate.toISOString());
console.log('dueDate as sent in notification (server local):', dueDate.toDateString());

// Simulate frontend formatting
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

console.log('dueDate as rendered on frontend:', formatDate(dueDate.toISOString()));
