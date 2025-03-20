document.addEventListener('DOMContentLoaded', () => {
    // Get room info from sessionStorage
    const roomId = sessionStorage.getItem('roomId');
    const password = sessionStorage.getItem('password');
    const isHost = sessionStorage.getItem('isHost') === 'true';
    
    if (!roomId || !password) {
        showToast('Error', 'Room information is missing', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }
    
    // Set room ID in header
    document.getElementById('room-id-display').textContent = `Room: ${roomId}`;
    
    // Set user role badge
    const userRoleBadge = document.getElementById('user-role-badge');
    userRoleBadge.textContent = isHost ? 'Host' : 'Participant';
    userRoleBadge.className = isHost ? 'badge' : 'badge outline';
    
    // Generate random username
    const userName = `User-${Math.floor(Math.random() * 1000)}`;
    
    // Set local user name
    document.getElementById('local-user-name').textContent = `${userName} (You)`;
    document.querySelector('#local-avatar span').textContent = userName.charAt(0);
    
    // Initialize variables
    let peer = null;
    const connections = {};
    let localStream = null;
    let isAudioEnabled = false;
    let isVideoEnabled = false;
    let isCallActive = false;
    let selectedFile = null;
    let participants = [];
    let messages = [];
    
    // Initialize peer connection
    function initializePeer() {
        const peerId = generatePeerId(roomId, userName);
        peer = new Peer(peerId, {
            debug: 2
        });
        
        peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            
            // Add self to participants
            addParticipant({
                id,
                name: userName,
                isHost
            });
            
            // Add system message
            addMessage({
                id: Date.now().toString(),
                sender: 'System',
                content: `You joined the room as ${isHost ? 'host' : 'participant'}`,
                timestamp: new Date(),
                type: 'system'
            });
            
            // If not host, connect to the host
            if (!isHost) {
                // In a real app, you would discover the host's peer ID through signaling
                // For demo purposes, we're using a simplified approach
                const hostId = `${roomId}-host`;
                connectToPeer(hostId);
            }
        });
        
        peer.on('connection', (conn) => {
            handleNewConnection(conn);
        });
        
        peer.on('call', (call) => {
            // Answer the call if we have media permissions
            if (localStream) {
                call.answer(localStream);
            } else {
                // If we don't have permissions yet, get them and then answer
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .then((stream) => {
                        localStream = stream;
                        const localVideo = document.getElementById('local-video');
                        localVideo.srcObject = stream;
                        call.answer(stream);
                    })
                    .catch(err => {
                        console.error('Failed to get local stream', err);
                        call.answer(); // Answer without media
                    });
            }
            
            call.on('stream', (remoteStream) => {
                // Add remote stream to video element
                addRemoteStream(call.peer, remoteStream);
            });
        });
        
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            showToast('Connection Error', err.message, 'error');
        });
    }
    
    function connectToPeer(peerId) {
        if (!peer) return;
        
        const conn = peer.connect(peerId, {
            reliable: true,
            metadata: {
                userName,
                isHost,
                roomId,
                password
            }
        });
        
        handleNewConnection(conn);
    }
    
    function handleNewConnection(conn) {
        conn.on('open', () => {
            console.log('Connection established with', conn.peer);
            connections[conn.peer] = conn;
            
            // Send current participants list to the new peer
            conn.send({
                type: 'participants',
                participants
            });
            
            // Add the new participant
            const peerName = conn.metadata?.userName || 'Unknown';
            const peerIsHost = conn.metadata?.isHost || false;
            
            addParticipant({
                id: conn.peer,
                name: peerName,
                isHost: peerIsHost
            });
            
            // Add system message
            addMessage({
                id: Date.now().toString(),
                sender: 'System',
                content: `${peerName} joined the room`,
                timestamp: new Date(),
                type: 'system'
            });
        });
        
        conn.on('data', (data) => {
            console.log('Received data:', data);
            
            if (data.type === 'message') {
                addMessage(data.message);
            } else if (data.type === 'participants') {
                // Update participants list
                data.participants.forEach((p) => {
                    if (!participants.some(np => np.id === p.id)) {
                        addParticipant(p);
                    }
                });
            } else if (data.type === 'file') {
                // Handle file reception
                addMessage({
                    id: Date.now().toString(),
                    sender: data.sender,
                    content: `Shared a file: ${data.fileName}`,
                    timestamp: new Date(),
                    type: 'file',
                    fileUrl: data.fileUrl,
                    fileName: data.fileName
                });
            }
        });
        
        conn.on('close', () => {
            console.log('Connection closed with', conn.peer);
            
            // Remove participant
            const peerName = participants.find(p => p.id === conn.peer)?.name || 'Someone';
            removeParticipant(conn.peer);
            
            // Add system message
            addMessage({
                id: Date.now().toString(),
                sender: 'System',
                content: `${peerName} left the room`,
                timestamp: new Date(),
                type: 'system'
            });
            
            delete connections[conn.peer];
        });
    }
    
    function addParticipant(participant) {
        // Check if participant already exists
        if (participants.some(p => p.id === participant.id)) {
            return;
        }
        
        participants.push(participant);
        updateParticipantsList();
    }
    
    function removeParticipant(participantId) {
        participants = participants.filter(p => p.id !== participantId);
        updateParticipantsList();
    }
    
    function updateParticipantsList() {
        const participantsList = document.getElementById('participants-list');
        participantsList.innerHTML = '';
        
        participants.forEach(participant => {
            const participantElement = document.createElement('div');
            participantElement.className = 'participant-item';
            participantElement.innerHTML = `
                <div class="participant-info">
                    <div class="participant-avatar">${participant.name.charAt(0)}</div>
                    <div>
                        <p class="participant-name">${escapeHtml(participant.name)}</p>
                        ${participant.isHost ? '<span class="badge">Host</span>' : ''}
                    </div>
                </div>
            `;
            participantsList.appendChild(participantElement);
        });
        
        // Update participant count
        document.getElementById('participant-count').textContent = `${participants.length} in this room`;
    }
    
    function addMessage(message) {
        messages.push(message);
        renderMessages();
    }
    
    function renderMessages() {
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            
            if (message.type === 'system') {
                messageElement.className = 'message message-system';
                messageElement.textContent = message.content;
            } else {
                const isOutgoing = message.sender === userName;
                messageElement.className = `message message-${isOutgoing ? 'outgoing' : 'incoming'}`;
                
                const messageBubble = document.createElement('div');
                messageBubble.className = 'message-bubble';
                
                const messageHeader = document.createElement('div');
                messageHeader.className = 'message-header';
                
                const messageSender = document.createElement('span');
                messageSender.className = 'message-sender';
                messageSender.textContent = message.sender;
                
                const messageTime = document.createElement('span');
                messageTime.className = 'message-time';
                messageTime.textContent = formatTimestamp(message.timestamp);
                
                messageHeader.appendChild(messageSender);
                messageHeader.appendChild(messageTime);
                
                const messageContent = document.createElement('div');
                messageContent.className = 'message-content';
                
                if (message.type === 'file') {
                    messageContent.innerHTML = `
                        <p>${escapeHtml(message.content)}</p>
                        <a href="${message.fileUrl}" download="${message.fileName}" class="message-file-link" target="_blank">
                            Download ${escapeHtml(message.fileName)}
                        </a>
                    `;
                } else {
                    messageContent.textContent = message.content;
                }
                
                messageBubble.appendChild(messageHeader);
                messageBubble.appendChild(messageContent);
                messageElement.appendChild(messageBubble);
            }
            
            messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const newMessage = {
            id: Date.now().toString(),
            sender: userName,
            content: message,
            timestamp: new Date(),
            type: 'text'
        };
        
        // Add to local messages
        addMessage(newMessage);
        
        // Send to all peers
        Object.values(connections).forEach(conn => {
            conn.send({
                type: 'message',
                message: newMessage
            });
        });
        
        // Clear input
        messageInput.value = '';
    }
    
    function sendFile() {
        if (!selectedFile) return;
        
        // In a real app, you would upload the file to a service and share the URL
        // For demo purposes, we'll create a local object URL
        const fileUrl = URL.createObjectURL(selectedFile);
        
        const fileMessage = {
            id: Date.now().toString(),
            sender: userName,
            content: `Shared a file: ${selectedFile.name}`,
            timestamp: new Date(),
            type: 'file',
            fileUrl,
            fileName: selectedFile.name
        };
        
        // Add to local messages
        addMessage(fileMessage);
        
        // Send to all peers
        Object.values(connections).forEach(conn => {
            conn.send({
                type: 'file',
                sender: userName,
                fileUrl,
                fileName: selectedFile.name
            });
        });
        
        // Clear selected file
        clearSelectedFile();
    }
    
    function toggleAudio() {
        if (!localStream) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    localStream = stream;
                    isAudioEnabled = true;
                    updateMediaButtons();
                })
                .catch(err => {
                    console.error('Error accessing audio:', err);
                    showToast('Audio Error', 'Could not access microphone', 'error');
                });
        } else {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            isAudioEnabled = audioTracks[0]?.enabled || false;
            updateMediaButtons();
        }
    }
    
    function toggleVideo() {
        if (!localStream) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then((stream) => {
                    localStream = stream;
                    const localVideo = document.getElementById('local-video');
                    localVideo.srcObject = stream;
                    isVideoEnabled = true;
                    updateMediaButtons();
                    toggleLocalVideoDisplay();
                })
                .catch(err => {
                    console.error('Error accessing video:', err);
                    showToast('Video Error', 'Could not access camera', 'error');
                });
        } else {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            isVideoEnabled = videoTracks[0]?.enabled || false;
            updateMediaButtons();
            toggleLocalVideoDisplay();
        }
    }
    
    function toggleLocalVideoDisplay() {
        const localVideo = document.getElementById('local-video');
        const localAvatar = document.getElementById('local-avatar');
        
        if (isVideoEnabled) {
            localVideo.style.display = 'block';
            localAvatar.style.display = 'none';
        } else {
            localVideo.style.display = 'none';
            localAvatar.style.display = 'flex';
        }
    }
    
    function updateMediaButtons() {
        const audioButton = document.getElementById('toggle-audio-button');
        const videoButton = document.getElementById('toggle-video-button');
        
        audioButton.innerHTML = isAudioEnabled ? 
            '<i class="fas fa-microphone"></i>' : 
            '<i class="fas fa-microphone-slash"></i>';
        
        videoButton.innerHTML = isVideoEnabled ? 
            '<i class="fas fa-video"></i>' : 
            '<i class="fas fa-video-slash"></i>';
        
        audioButton.className = `button ${isAudioEnabled ? 'primary-button' : 'outline-button'} icon-button`;
        videoButton.className = `button ${isVideoEnabled ? 'primary-button' : 'outline-button'} icon-button`;
    }
    
    function startCall() {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                localStream = stream;
                
                const localVideo = document.getElementById('local-video');
                localVideo.srcObject = stream;
                
                isAudioEnabled = true;
                isVideoEnabled = true;
                isCallActive = true;
                
                updateMediaButtons();
                toggleLocalVideoDisplay();
                updateCallButton();
                
                // Clear no participants message
                document.querySelector('.no-participants-message').style.display = 'none';
                
                // Call all peers
                Object.keys(connections).forEach(peerId => {
                    if (!peer) return;
                    const call = peer.call(peerId, stream);
                    
                    call.on('stream', (remoteStream) => {
                        addRemoteStream(peerId, remoteStream);
                    });
                });
            })
            .catch(err => {
                console.error('Error starting call:', err);
                showToast('Call Error', 'Could not start call. Please check camera and microphone permissions.', 'error');
            });
    }
    
    function endCall() {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        isAudioEnabled = false;
        isVideoEnabled = false;
        isCallActive = false;
        
        updateMediaButtons();
        toggleLocalVideoDisplay();
        updateCallButton();
        
        // Clear remote videos
        const remoteVideosContainer = document.getElementById('remote-videos-container');
        remoteVideosContainer.innerHTML = `
            <div class="no-participants-message">
                <p>No participants in call</p>
            </div>
        `;
    }
    
    function updateCallButton() {
        const callButton = document.getElementById('call-button');
        
        if (isCallActive) {
            callButton.innerHTML = '<i class="fas fa-phone-slash"></i> End Call';
            callButton.className = 'button destructive-button';
            callButton.onclick = endCall;
        } else {
            callButton.innerHTML = '<i class="fas fa-phone"></i> Start Call';
            callButton.className = 'button primary-button';
            callButton.onclick = startCall;
        }
    }
    
    function addRemoteStream(peerId, stream) {
        const remoteVideosContainer = document.getElementById('remote-videos-container');
        
        // Remove no participants message
        const noParticipantsMessage = remoteVideosContainer.querySelector('.no-participants-message');
        if (noParticipantsMessage) {
            remoteVideosContainer.removeChild(noParticipantsMessage);
        }
        
        // Check if video already exists
        const existingVideo = document.getElementById(`remote-video-${peerId}`);
        if (existingVideo) {
            existingVideo.srcObject = stream;
            return;
        }
        
        // Get participant info
        const participant = participants.find(p => p.id === peerId);
        const participantName = participant ? participant.name : 'Unknown';
        
        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.id = `remote-container-${peerId}`;
        
        // Create video element
        const videoElement = document.createElement('video');
        videoElement.id = `remote-video-${peerId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = stream;
        
        // Create name overlay
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'video-overlay';
        nameOverlay.textContent = participantName;
        
        // Add elements to container
        videoContainer.appendChild(videoElement);
        videoContainer.appendChild(nameOverlay);
        
        // Add to remote videos container
        remoteVideosContainer.appendChild(videoContainer);
    }
    
    function handleFileChange(e) {
        const fileInput = e.target;
        if (fileInput.files && fileInput.files[0]) {
            selectedFile = fileInput.files[0];
            showFilePreview();
        }
    }
    
    function showFilePreview() {
        const filePreview = document.getElementById('file-preview');
        filePreview.classList.add('active');
        
        filePreview.innerHTML = `
            <p class="file-name">${escapeHtml(selectedFile.name)}</p>
            <div class="file-actions">
                <button class="button outline-button" id="cancel-file-button">Cancel</button>
                <button class="button primary-button" id="send-file-button">Send</button>
            </div>
        `;
        
        document.getElementById('cancel-file-button').addEventListener('click', clearSelectedFile);
        document.getElementById('send-file-button').addEventListener('click', sendFile);
    }
    
    function clearSelectedFile() {
        selectedFile = null;
        const filePreview = document.getElementById('file-preview');
        filePreview.classList.remove('active');
        filePreview.innerHTML = '';
        document.getElementById('file-upload').value = '';
    }
    
    function showToast(title, message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        
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
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('slide-out');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, 5000);
        
        // Close button
        const closeButton = toast.querySelector('.toast-close');
        closeButton.addEventListener('click', () => {
            toast.classList.add('slide-out');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        });
    }
    
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
    
    // Event listeners
    document.getElementById('send-message-button').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    document.getElementById('file-button').addEventListener('click', () => {
        document.getElementById('file-upload').click();
    });
    
    document.getElementById('file-upload').addEventListener('change', handleFileChange);
    
    document.getElementById('toggle-audio-button').addEventListener('click', toggleAudio);
    document.getElementById('toggle-video-button').addEventListener('click', toggleVideo);
    document.getElementById('call-button').addEventListener('click', startCall);
    
    document.getElementById('leave-room-button').addEventListener('click', () => {
        // Clean up
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        Object.values(connections).forEach(conn => {
            if (conn && typeof conn.close === 'function') {
                conn.close();
            }
        });
        
        if (peer) {
            peer.destroy();
        }
        
        // Redirect to home page
        window.location.href = 'index.html';
    });
    
    // Initialize
    initializePeer();
});
