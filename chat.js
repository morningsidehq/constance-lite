class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.createChatButton();
        this.createChatWindow();
        this.attachEventListeners();
    }

    createChatButton() {
        this.chatButton = document.createElement('button');
        this.chatButton.className = 'chat-button';
        this.chatButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        `;
        document.body.appendChild(this.chatButton);
    }

    createChatWindow() {
        this.chatWindow = document.createElement('div');
        this.chatWindow.className = 'chat-window';
        this.chatWindow.style.display = 'none';
        this.chatWindow.innerHTML = `
            <div class="chat-header">
                <h3>Support Chat</h3>
                <button class="close-chat">&times;</button>
            </div>
            <div class="chat-messages"></div>
            <div class="chat-input-container">
                <textarea class="chat-input" placeholder="Type your message..."></textarea>
                <button class="send-message">Send</button>
            </div>
        `;
        document.body.appendChild(this.chatWindow);
    }

    attachEventListeners() {
        this.chatButton.addEventListener('click', () => this.toggleChat());
        this.chatWindow.querySelector('.close-chat').addEventListener('click', () => this.toggleChat());
        this.chatWindow.querySelector('.send-message').addEventListener('click', () => this.sendMessage());
        this.chatWindow.querySelector('.chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.chatWindow.style.display = this.isOpen ? 'flex' : 'none';
    }

    addMessageToChat(message, type) {
        const messagesContainer = this.chatWindow.querySelector('.chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}-message`;
        messageElement.textContent = message;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async getCurrentUser() {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            console.error('Error getting user:', error);
            return null;
        }
        return user;
    }

    async sendMessage() {
        const input = this.chatWindow.querySelector('.chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        try {
            const user = await this.getCurrentUser();
            if (!user) {
                alert('Please login to send messages');
                return;
            }

            // Insert message into Supabase
            const { data: messageData, error } = await supabaseClient
                .from('support_messages')
                .insert([
                    {
                        user_id: user.id,
                        message: message,
                        user_email: user.email,
                        status: 'pending'
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // Send to Telegram via Edge Function
            await supabaseClient.functions.invoke('send-to-telegram', {
                body: {
                    message: `New message from ${user.email}:\n\n${message}`,
                    messageId: messageData.id
                }
            });

            input.value = '';
            this.addMessageToChat(message, 'user');
            this.addMessageToChat('Thank you for your message. Our team will respond shortly.', 'system');

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    }
}

// Initialize chat widget when document is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChatWidget();
}); 