import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LANGUAGES, STORAGE_KEYS } from '../constants';
import { authService } from '../services/authService';
import { createChatSession, generateMessageStream, generateImage, prepareHistory } from '../services/geminiService';
import { Message, MessageRole, MessageType, StoredChat, ChatSettings } from '../types';
import { Chat, GenerateContentResponse } from '@google/genai';
import { Spinner, Input, Button } from '../components/UI';

// Utility to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
       const result = reader.result as string;
       const base64 = result.split(',')[1];
       resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// --- Components ---

const TypingIndicator: React.FC<{ mode: 'thinking' | 'typing' }> = ({ mode }) => (
  <div className="flex items-center gap-2 px-3 py-3 bg-[#141414] rounded-2xl w-fit animate-slide-up border border-white/5">
    <div className="flex gap-1">
       {mode === 'thinking' ? (
         <>
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse delay-75"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse delay-150"></div>
            <span className="text-[10px] text-slate-400 ml-1 font-medium animate-pulse">Thinking...</span>
         </>
       ) : (
         <>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-100"></div>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-200"></div>
         </>
       )}
    </div>
  </div>
);

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 md:mx-0 mx-1 rounded-md overflow-hidden border border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)] bg-[#0B0C0E] group animate-fade-in relative transition-all duration-300 hover:shadow-emerald-500/10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#14161F] border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-400 lowercase opacity-90 font-bold tracking-wide">{language || 'code'}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 text-[10px] text-slate-400 hover:text-white transition-colors"
        >
           {copied ? <span className="text-emerald-400 font-medium">Copied</span> : <span>Copy</span>}
        </button>
      </div>
      {/* Code Body */}
      <div className="p-3 overflow-x-auto custom-scrollbar bg-[#0B0C0E]">
        <pre className="font-mono text-[12px] md:text-[13px] text-slate-300 leading-relaxed min-w-full">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

// --- Settings Modal Component ---
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onClearHistory: () => void }> = ({ isOpen, onClose, onClearHistory }) => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'data'>('account');
  
  // Form States
  const [newName, setNewName] = useState(user?.username || '');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.updateProfile(user!.username, newName);
      addToast("Username updated. Please re-login.", "success");
      logout();
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authService.changePassword(user!.username, oldPass, newPass);
      addToast("Password changed successfully.", "success");
      setOldPass(''); setNewPass('');
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[500px]">
        
        {/* Sidebar Tabs */}
        <div className="w-full md:w-48 bg-black/40 border-r border-white/5 p-4 flex flex-col gap-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Settings</div>
          <button onClick={() => setActiveTab('account')} className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'account' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}`}>Account</button>
          <button onClick={() => setActiveTab('security')} className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'security' ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}`}>Security</button>
          <button onClick={() => setActiveTab('data')} className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === 'data' ? 'bg-red-500/10 text-red-400' : 'text-slate-400 hover:bg-white/5'}`}>Data Controls</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 relative overflow-y-auto">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            
            {activeTab === 'account' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white">General</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                   <div>
                     <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                     <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                   </div>
                   <Button type="submit" variant="primary" className="w-full text-sm" isLoading={isLoading}>Update Profile</Button>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
               <div className="space-y-6">
               <h3 className="text-lg font-bold text-white">Security</h3>
               <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Old Password</label>
                    <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Enter current password" required />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">New Password</label>
                    <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="Min 12 characters" required minLength={12} />
                  </div>
                  <Button type="submit" variant="primary" className="w-full text-sm" isLoading={isLoading}>Change Password</Button>
               </form>
             </div>
            )}

            {activeTab === 'data' && (
               <div className="space-y-6">
                 <h3 className="text-lg font-bold text-red-400">Chat History</h3>
                 <p className="text-xs text-slate-400">Clear all your conversation history. This action cannot be undone, but your account will remain active.</p>
                 <button onClick={onClearHistory} disabled={isLoading} className="w-full py-2 px-4 bg-red-900/20 border border-red-900/50 text-red-500 rounded-lg text-sm font-bold hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2">
                    {isLoading ? <Spinner /> : "Clear All Chat History"}
                 </button>
               </div>
            )}
        </div>
      </div>
    </div>
  );
};


// --- Main Interface ---

export const ChatInterface: React.FC = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  
  // Core State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatHistory, setChatHistory] = useState<StoredChat[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Attachment State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [attachedLink, setAttachedLink] = useState<string | null>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState('');

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Settings State - DEFAULT ON
  const [settings, setSettings] = useState<ChatSettings>({
    enableSearch: true,
    enableThinking: true
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Network Status Listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Click Outside Listeners
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
         setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load History
  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (savedHistory) {
        try {
            setChatHistory(JSON.parse(savedHistory));
        } catch (e) {
            console.error("Failed to parse chat history", e);
        }
    }
  }, []);

  // Initialize Chat
  const initChat = async (messagesToRestore: Message[] = []) => {
    const langCode = authService.getLanguage() || 'en';
    const langConfig = LANGUAGES.find(l => l.code === langCode);
    const historyContent = prepareHistory(messagesToRestore);
    const session = createChatSession(langConfig?.systemPromptSnippet || '', historyContent);
    setChatSession(session);
    
    if (messagesToRestore.length === 0 && !user) {
       setMessages([{
        id: 'welcome',
        role: MessageRole.MODEL,
        type: MessageType.TEXT,
        content: `Hello! I am Raynex AI. How can I assist you today?`,
        timestamp: Date.now()
      }]);
    } else {
        setMessages(messagesToRestore);
    }
  };

  useEffect(() => {
    if (user && !chatSession) {
      initChat();
    }
  }, [user]);

  // --- Features ---

  const saveCurrentChatToHistory = () => {
      if (messages.length <= 1) return;
      if (currentChatId) {
          const updatedHistory = chatHistory.map(chat => 
            chat.id === currentChatId 
                ? { ...chat, messages: messages, timestamp: Date.now() }
                : chat
          );
          setChatHistory(updatedHistory);
          localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(updatedHistory));
      } else {
          const newId = Date.now().toString();
          const title = messages.find(m => m.role === MessageRole.USER)?.content.substring(0, 30) + "..." || "New Conversation";
          const newChat: StoredChat = {
              id: newId,
              title: title,
              messages: messages,
              timestamp: Date.now()
          };
          const updatedHistory = [newChat, ...chatHistory];
          setChatHistory(updatedHistory);
          localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(updatedHistory));
      }
  };

  const handleNewChat = () => {
    saveCurrentChatToHistory();
    setCurrentChatId(null);
    setMessages([{
        id: 'welcome-' + Date.now(),
        role: MessageRole.MODEL,
        type: MessageType.TEXT,
        content: `Hello! I am Raynex AI. Ready for a new task?`,
        timestamp: Date.now()
    }]);
    initChat([]);
    setIsSidebarOpen(false);
  };

  const loadChatFromHistory = (chatId: string) => {
      saveCurrentChatToHistory();
      const chatToLoad = chatHistory.find(c => c.id === chatId);
      if (chatToLoad) {
          setCurrentChatId(chatId);
          setMessages(chatToLoad.messages);
          initChat(chatToLoad.messages);
          setIsSidebarOpen(false);
      }
  };

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = chatHistory.filter(c => c.id !== chatId);
    setChatHistory(updatedHistory);
    localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(updatedHistory));
    if (currentChatId === chatId) {
        handleNewChat();
    }
    addToast("Chat deleted", "info");
  };

  const shareChat = (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const chatToShare = chatHistory.find(c => c.id === chatId);
      if (chatToShare) {
          const text = chatToShare.messages
              .filter(m => m.type === MessageType.TEXT)
              .map(m => `${m.role === MessageRole.USER ? 'User' : 'Raynex AI'}: ${m.content}`)
              .join('\n\n');
          
          navigator.clipboard.writeText(text).then(() => {
              addToast("Chat conversation copied to clipboard!", "success");
          }).catch(() => {
              addToast("Failed to copy to clipboard", "error");
          });
      }
  };

  const handleClearAllHistory = () => {
      if (confirm("Are you sure you want to clear ALL chat history?")) {
        localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY);
        setChatHistory([]);
        handleNewChat();
        addToast("All chat history cleared", "success");
      }
  };

  // --- File & Camera Handling ---

  const handleAttachmentClick = (type: 'image' | 'doc') => {
      if (fileInputRef.current) {
          fileInputRef.current.accept = type === 'image' ? "image/*" : ".pdf,.txt,.js,.py,.html,.css,.json,.md,.csv";
          fileInputRef.current.click();
      }
      setIsAttachMenuOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
          setFilePreview(URL.createObjectURL(file));
      } else {
          setFilePreview(null);
      }
      setIsAttachMenuOpen(false);
  };

  const clearFileSelection = () => {
    setSelectedFile(null); setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearLinkSelection = () => { setAttachedLink(null); };

  const startCamera = async () => {
      setIsAttachMenuOpen(false); setIsCameraOpen(true);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setCameraStream(stream);
          if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
          addToast("Could not access camera.", "error");
          setIsCameraOpen(false);
      }
  };

  const stopCamera = () => {
      if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); setCameraStream(null); }
      setIsCameraOpen(false);
  };

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const context = canvasRef.current.getContext('2d');
          if (context) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              context.drawImage(videoRef.current, 0, 0);
              canvasRef.current.toBlob((blob) => {
                  if (blob) {
                      const file = new File([blob], `cam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                      processFile(file); stopCamera();
                  }
              }, 'image/jpeg');
          }
      }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedFile && !attachedLink) || isProcessing || !chatSession) return;

    const userMsgId = Date.now().toString();
    let currentInput = input;
    const currentFile = selectedFile;
    const currentPreview = filePreview;
    const currentLink = attachedLink;
    const currentSettings = { ...settings }; 

    // Inject link context
    if (currentLink) currentInput = `${currentInput}\n\n[Analyze this Link: ${currentLink}]`;

    // Get Language Prompt for Strict Enforcement
    const langCode = authService.getLanguage() || 'en';
    const langConfig = LANGUAGES.find(l => l.code === langCode);
    const langPrompt = langConfig?.systemPromptSnippet;

    const newMessage: Message = {
      id: userMsgId,
      role: MessageRole.USER,
      type: currentFile && currentFile.type.startsWith('image/') ? MessageType.IMAGE_UPLOAD : MessageType.TEXT,
      content: currentInput,
      timestamp: Date.now(),
    };
    
    if (currentFile) {
        newMessage.content = currentFile.type.startsWith('image/') && currentPreview 
            ? `${currentInput}|${currentPreview}` 
            : `${currentInput}|FILE:${currentFile.name}|${currentFile.type}`;
    }

    setMessages(prev => [...prev, newMessage]);
    setInput(''); clearFileSelection(); clearLinkSelection();
    setIsProcessing(true);

    try {
      const lowerInput = currentInput.toLowerCase();
      const isGenerationRequest = lowerInput.startsWith('/imagine') || lowerInput.includes('generate an image') || lowerInput.includes('create an image') || lowerInput.includes('tasveer banao');

      if (isGenerationRequest && !currentFile) {
        const aiMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: aiMsgId, role: MessageRole.MODEL, type: MessageType.TEXT, content: "Generating image...", timestamp: Date.now() }]);
        const imageBase64 = await generateImage(currentInput);
        setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, type: MessageType.IMAGE_GENERATED, content: `data:image/jpeg;base64,${imageBase64}` } : msg));
      } else {
        const base64 = currentFile ? await fileToBase64(currentFile) : undefined;
        // PASS LANGUAGE PROMPT HERE
        const streamResult = await generateMessageStream(chatSession, currentInput, base64, currentFile?.type, currentSettings, langPrompt);
        const aiMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: aiMsgId, role: MessageRole.MODEL, type: MessageType.TEXT, content: '', timestamp: Date.now() }]);

        let fullText = '';
        for await (const chunk of streamResult) {
            const responseChunk = chunk as GenerateContentResponse;
            const candidates = responseChunk.candidates;
            if (candidates && candidates.length > 0) {
                const groundingMetadata = candidates[0].groundingMetadata;
                const parts = candidates[0].content?.parts;
                if (parts) {
                    for (const part of parts) {
                        if (part.inlineData) {
                            const imageUrl = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
                            setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, type: MessageType.IMAGE_GENERATED, content: imageUrl } : msg));
                        } else if (part.text) {
                            fullText += part.text;
                            setMessages(prev => prev.map(msg => msg.id === aiMsgId && msg.type === MessageType.TEXT ? { ...msg, content: fullText, groundingMetadata } : msg));
                        }
                    }
                }
            }
        }
      }
    } catch (error: any) {
      addToast("Error: " + error.message, 'error');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, type: MessageType.TEXT, content: "Error processing request.", timestamp: Date.now(), isError: true }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMessageContent = (text: string) => {
    const parts: ({ type: 'text'; content: string } | { type: 'code'; language: string; content: string })[] = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      parts.push({ type: 'code', language: match[1], content: match[2] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', content: text.substring(lastIndex) });
    
    return parts.map((part, index) => {
      if (part.type === 'code') return <CodeBlock key={index} language={part.language} code={part.content} />;
      
      // Bold text parsing: **text**
      const content = part.content;
      const boldParts = content.split(/(\*\*.*?\*\*)/g);
      
      return (
        <span key={index} className="whitespace-pre-wrap">
            {boldParts.map((bp, i) => {
                if (bp.startsWith('**') && bp.endsWith('**')) {
                    return <strong key={i} className="text-white font-bold">{bp.slice(2, -2)}</strong>;
                }
                return bp;
            })}
        </span>
      );
    });
  };

  return (
    <div className="flex h-screen bg-black text-slate-100 overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-50 text-[14px]">
      
      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onClearHistory={handleClearAllHistory}
      />
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-md transition-opacity" onClick={() => setIsSidebarOpen(false)} />}
      
      {isCameraOpen && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
              <video ref={videoRef} autoPlay playsInline className="flex-1 w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-0 left-0 w-full p-8 flex justify-center gap-8 bg-black/50 backdrop-blur">
                  <button onClick={stopCamera} className="text-white font-bold">Cancel</button>
                  <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300"></button>
              </div>
          </div>
      )}

      {isLinkModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-xl p-5">
                  <h3 className="font-bold text-white mb-3">Add Web Link</h3>
                  <form onSubmit={(e) => { e.preventDefault(); if(linkInputValue) { setAttachedLink(linkInputValue); setIsLinkModalOpen(false); setLinkInputValue(''); }}}>
                      <input type="url" placeholder="https://..." className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 mb-4 focus:border-emerald-500 outline-none text-sm" value={linkInputValue} onChange={e => setLinkInputValue(e.target.value)} autoFocus />
                      <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-3 py-1.5 text-xs font-medium text-slate-400">Cancel</button>
                          <button type="submit" className="px-4 py-1.5 text-xs font-bold bg-emerald-500 text-black rounded-lg">Add</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Sidebar (Compact Width: w-[260px]) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#000000] border-r border-white/10 transform transition-transform duration-300 flex flex-col md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          {/* Dynamic Glass Background for Logo Area */}
          <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-blue-500/10 blur-xl rounded-xl opacity-50"></div>
              <div className="relative flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] overflow-hidden group">
                  {/* Shine Effect */}
                  <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  
                  <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-white to-slate-300 flex items-center justify-center shadow-[0_2px_10px_rgba(255,255,255,0.2)] border border-white">
                          <svg className="w-5 h-5 text-black drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                      </div>
                      <div className="flex flex-col">
                          <span className="font-bold text-[15px] text-white tracking-tight leading-none drop-shadow-md">RayNex AI</span>
                          <span className="text-[10px] text-emerald-400 font-medium tracking-widest uppercase mt-0.5 drop-shadow">Limitless</span>
                      </div>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
          </div>

          <button onClick={handleNewChat} className="w-full flex items-center gap-2.5 px-3 py-2.5 mb-6 text-xs font-medium text-white bg-[#1A1A1A] hover:bg-[#252525] border border-white/5 rounded-lg transition-all group">
            <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span>New Chat</span>
          </button>

          <div className="flex-1">
            <div className="px-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">History</div>
            <div className="space-y-0.5">
                {chatHistory.map(chat => (
                    <div key={chat.id} className="group relative flex items-center rounded-md hover:bg-[#1A1A1A]">
                        <button onClick={() => loadChatFromHistory(chat.id)} className={`flex-1 text-left px-3 py-2 text-[13px] truncate ${currentChatId === chat.id ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                            <span className="truncate block pr-12">{chat.title}</span>
                        </button>
                        
                        {/* Share & Delete Actions */}
                        <div className="absolute right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 bg-[#1A1A1A] pl-1">
                            <button onClick={(e) => shareChat(chat.id, e)} className="p-1 text-slate-500 hover:text-emerald-400" title="Copy Chat to Clipboard">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                            </button>
                            <button onClick={(e) => deleteChat(chat.id, e)} className="p-1 text-slate-500 hover:text-red-400" title="Delete Chat">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </div>

        {/* Compact Profile Menu */}
        <div className="p-3 border-t border-white/5 bg-black relative" ref={langMenuRef}>
            {showLangMenu && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-50 animate-slide-up overflow-hidden">
                    <div className="p-1.5">
                        <div className="text-[10px] font-bold text-slate-600 px-2 py-1.5 uppercase">Options</div>
                        <button onClick={() => { setIsSettingsOpen(true); setShowLangMenu(false); }} className="w-full text-left px-2 py-2 text-xs rounded-lg text-slate-300 hover:bg-white/10 flex items-center gap-2 mb-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Settings
                        </button>
                        <div className="h-px bg-white/5 my-1"></div>
                        <div className="text-[10px] font-bold text-slate-600 px-2 py-1.5 uppercase">Language</div>
                        {LANGUAGES.map(lang => (
                            <button key={lang.code} onClick={() => {authService.setLanguage(lang.code); setShowLangMenu(false); window.location.reload();}} className={`w-full text-left px-2 py-1.5 text-xs rounded-lg flex items-center justify-between ${authService.getLanguage() === lang.code ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5'}`}>
                                {lang.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div onClick={() => setShowLangMenu(!showLangMenu)} className="flex items-center gap-2 p-2 rounded-xl bg-[#141414] hover:bg-[#1A1A1A] cursor-pointer border border-white/5 hover:border-white/10 select-none group">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white to-slate-400 flex items-center justify-center text-black font-bold text-xs relative">
                    {user?.username?.charAt(0).toUpperCase()}
                    {/* Network Status Indicator */}
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#141414] ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="text-xs font-semibold text-white truncate">{user?.username}</div>
                    <div className={`text-[9px] font-medium uppercase tracking-wide ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); logout(); }} className="text-slate-600 hover:text-red-400 p-1 hover:bg-white/5 rounded" title="Logout">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content - Compact Padding */}
      <main className="flex-1 flex flex-col relative bg-black w-full">
        <div className="md:hidden flex items-center justify-between p-3 border-b border-white/10 bg-black/90 backdrop-blur z-20 absolute top-0 w-full">
            <button onClick={() => setIsSidebarOpen(true)} className="text-slate-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
            <span className="font-bold text-sm text-white">RayNex AI</span>
            <button onClick={handleNewChat} className="text-slate-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
           <div className="flex flex-col min-h-full pb-36 pt-16 md:pt-0">
             {messages.map((msg) => (
                <div key={msg.id} className={`w-full py-5 ${msg.role === MessageRole.USER ? 'bg-transparent' : 'bg-[#0A0A0A]/50 border-y border-white/[0.02]'}`}>
                    <div className={`max-w-3xl mx-auto flex gap-4 px-4 ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-6.5 h-6.5 rounded-sm flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-lg ${msg.role === MessageRole.USER ? 'bg-[#333] text-white' : 'bg-white text-black'}`}>
                            {msg.role === MessageRole.USER ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
                        </div>
                        <div className={`relative flex-1 overflow-hidden pt-0.5 ${msg.role === MessageRole.USER ? 'text-right' : 'text-left'}`}>
                            <div className="font-bold text-[11px] text-slate-500 mb-1 uppercase">{msg.role === MessageRole.USER ? 'You' : 'RayNex AI'}</div>
                            <div className={`inline-block text-slate-200 text-[14.5px] leading-7 font-light tracking-wide whitespace-pre-wrap ${msg.role === MessageRole.USER ? 'bg-[#2F2F2F] px-4 py-2 rounded-2xl text-left' : ''}`}>
                                {msg.content && msg.content.includes('|FILE:') ? (
                                    <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-lg border border-white/10 w-fit">
                                        <div className="bg-emerald-500/20 p-1.5 rounded"><svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                                        <div className="flex flex-col text-left"><span className="text-xs font-medium text-white">{msg.content.split('|')[1].replace('FILE:', '')}</span></div>
                                    </div>
                                ) : (
                                    msg.content ? renderMessageContent(msg.content) : <TypingIndicator mode={settings.enableThinking ? 'thinking' : 'typing'} />
                                )}
                                {msg.type === MessageType.IMAGE_GENERATED && <div className="mt-2"><img src={msg.content} alt="Generated" className="rounded-lg shadow-xl max-w-sm border border-white/10" /></div>}
                                {msg.groundingMetadata?.groundingChunks && (
                                    <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-2">
                                        {msg.groundingMetadata.groundingChunks.map((c: any, i: number) => c.web?.uri && <a key={i} href={c.web.uri} target="_blank" rel="noreferrer" className="text-[10px] bg-white/5 px-2 py-1 rounded text-emerald-400 hover:text-emerald-300 border border-white/5 truncate max-w-[200px]">{c.web.title || 'Source'}</a>)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
             ))}
             <div ref={messagesEndRef} />
           </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-5 px-4 z-10">
            <div className="max-w-3xl mx-auto">
                {(selectedFile || attachedLink) && (
                    <div className="mb-2 flex items-center gap-2 bg-[#1A1A1A] backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 w-fit animate-slide-up">
                         <span className="text-xs font-medium text-white truncate max-w-[150px]">{attachedLink || selectedFile?.name}</span>
                         <button onClick={() => { clearFileSelection(); clearLinkSelection(); }} className="text-slate-500 hover:text-white"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                )}
                <div className="relative group">
                    <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 bg-[#141414] border border-white/10 focus-within:border-white/20 rounded-[26px] shadow-xl px-2 py-2 transition-colors duration-300">
                         <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                         <div className="relative" ref={attachMenuRef}>
                            <button type="button" onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>
                            {isAttachMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[140px] flex flex-col gap-0.5 animate-slide-up">
                                    <button type="button" onClick={startCamera} className="px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg text-left flex gap-2 items-center"><svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Camera</button>
                                    <button type="button" onClick={() => handleAttachmentClick('image')} className="px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg text-left flex gap-2 items-center"><svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> Photos</button>
                                    <button type="button" onClick={() => handleAttachmentClick('doc')} className="px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg text-left flex gap-2 items-center"><svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> File</button>
                                    <button type="button" onClick={() => {setIsLinkModalOpen(true); setIsAttachMenuOpen(false);}} className="px-3 py-2 text-xs text-slate-200 hover:bg-white/10 rounded-lg text-left flex gap-2 items-center"><svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> Link</button>
                                </div>
                            )}
                         </div>
                         <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); handleSendMessage();}}} placeholder="Message RayNex AI..." className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:ring-0 resize-none py-3 max-h-[150px] min-h-[24px] text-sm leading-relaxed" rows={1} disabled={isProcessing} />
                         <button type="submit" disabled={(!input.trim() && !selectedFile && !attachedLink) || isProcessing} className={`p-2 rounded-xl m-0.5 flex items-center justify-center transition-all ${(!input.trim() && !selectedFile && !attachedLink) || isProcessing ? 'bg-white/5 text-slate-600' : 'bg-white text-black hover:scale-105'}`}>
                             {isProcessing ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>}
                         </button>
                    </form>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                     <button onClick={() => setSettings(s => ({ ...s, enableSearch: !s.enableSearch }))} className={`text-[10px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-full border ${settings.enableSearch ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-slate-500 border-transparent'}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg> Search
                     </button>
                     <button onClick={() => setSettings(s => ({ ...s, enableThinking: !s.enableThinking }))} className={`text-[10px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-full border ${settings.enableThinking ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'text-slate-500 border-transparent'}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> Think
                     </button>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};