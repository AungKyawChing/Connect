document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding tab pane
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Create room
    const createRoomButton = document.getElementById('create-room-button');
    createRoomButton.addEventListener('click', () => {
        const roomId = document.getElementById('create-room-id').value.trim();
        const password = document.getElementById('create-password').value.trim();
        
        if (!roomId || !password) {
            showToast('Error', 'Room ID and password are required', 'error');
            return;
        }
        
        // Store room info in sessionStorage
        sessionStorage.setItem('roomId', roomId);
        sessionStorage.setItem('password', password);
        sessionStorage.setItem('isHost', 'true');
        
        // Redirect to room page
        window.location.href = `room.html`;
    });

    // Join room
    const joinRoomButton = document.getElementById('join-room-button');
    joinRoomButton.addEventListener('click', () => {
        const roomId = document.getElementById('join-room-id').value.trim();
        const password = document.getElementById('join-password').value.trim();
        
        if (!roomId || !password) {
            showToast('Error', 'Room ID and password are required', 'error');
            return;
        }
        
        // Store room info in sessionStorage
        sessionStorage.setItem('roomId', roomId);
        sessionStorage.setItem('password', password);
        sessionStorage.setItem('isHost', 'false');
        
        // Redirect to room page
        window.location.href = `room.html`;
    });

    // Toast function
    function showToast(title, message, type = 'success') {
        const toastContainer = document.createElement('div');
        toastContainer.classList.add('toast-container');
        
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.classList.add(`toast-${type}`);
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-description">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        document.body.appendChild(toastContainer);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('slide-out');
            setTimeout(() => {
                document.body.removeChild(toastContainer);
            }, 300);
        }, 5000);
        
        // Close button
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', () => {
            toast.classList.add('slide-out');
            setTimeout(() => {
                document.body.removeChild(toastContainer);
            }, 300);
        });
    }
});
