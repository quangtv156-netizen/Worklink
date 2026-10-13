import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { currentUser, setIsAuthModalOpen, showToast } = useAuth();
  const [activeChatRecipient, setActiveChatRecipient] = useState(null);

  // Khi user logout, tự động đóng khung chat
  const prevUserRef = React.useRef(currentUser);
  useEffect(() => {
    if (prevUserRef.current && !currentUser) {
      setActiveChatRecipient(null);
    }
    prevUserRef.current = currentUser;
  }, [currentUser]);

  // Guarded modal opener: require login
  const handleSetActiveChatRecipient = (recipient) => {
    if (!recipient) {
      setActiveChatRecipient(null);
      return;
    }
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để gửi tin nhắn trao đổi!', 'info');
      return;
    }
    setActiveChatRecipient(recipient);
  };

  const openChatWith = (recipient) => {
    handleSetActiveChatRecipient(recipient);
  };

  const closeChat = () => {
    setActiveChatRecipient(null);
  };

  return (
    <ChatContext.Provider
      value={{
        activeChatRecipient,
        setActiveChatRecipient: handleSetActiveChatRecipient,
        openChatWith,
        closeChat
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
