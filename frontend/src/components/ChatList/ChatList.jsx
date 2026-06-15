import React, { useState } from 'react';
import './ChatList.css';

const ChatList = ({ chats, onSelectChat, onSearch, searchResults, onStartChat, onDeleteChat, onCreateGroup, selectedChat, onSelectArchive }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isGroupMode, setIsGroupMode] = useState(false);
    const [selectedForGroup, setSelectedForGroup] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [viewMode, setViewMode] = useState('chats');

    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        onSearch(query);
    };

    const toggleGroupParticipant = (id) => {
        setSelectedForGroup(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleCreateGroupAction = () => {
        if (groupName.trim() && selectedForGroup.length > 0) {
            onCreateGroup(groupName.trim(), selectedForGroup);
            setGroupName('');
            setSelectedForGroup([]);
            setIsGroupMode(false);
        } else {
            alert("ВВЕДИТЕ НАЗВАНИЕ И ВЫБЕРИТЕ УЧАСТНИКОВ");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (isGroupMode) handleCreateGroupAction();
        }
    };

    const archiveItems = [
        { id: 'arc_1', name: 'ЛОГ_СЕКТОРА_C13', corruption: 45, type: 'ARCHIVE' },
        { id: 'arc_2', name: 'ОТЧЕТ_ИНСПЕКТОРА', corruption: 15, type: 'ARCHIVE' },
        { id: 'arc_3', name: 'ПРОТОКОЛ_ПОБЕГА', corruption: 92, type: 'ARCHIVE' },
    ];

    return (
        <div className="raya-window chat-list-window">
            <div className="raya-scanlines"></div>
            <div className="raya-window-inner">
                <header className="raya-header no-border">
                    <div className="view-selector">
                        <button className={`selector-btn ${viewMode === 'chats' ? 'active' : ''}`} onClick={() => setViewMode('chats')}>СВЯЗЬ</button>
                        <button className={`selector-btn ${viewMode === 'archive' ? 'active' : ''}`} onClick={() => setViewMode('archive')}>АРХИВ</button>
                    </div>
                </header>

                {viewMode === 'chats' && (
                    <div className="raya-header">
                        <div className="raya-info">
                            <div className="raya-label">МЕНЕДЖЕР СВЯЗИ</div>
                        </div>
                        <button className="raya-btn-mini" onClick={() => setIsGroupMode(!isGroupMode)}>
                            {isGroupMode ? '[ОТМЕНА]' : '[+ГРУППА]'}
                        </button>
                    </div>
                )}

                {viewMode === 'chats' && (
                    isGroupMode ? (
                        <div className="group-creation-area">
                            <input type="text" className="chat-search-input" placeholder="НАЗВАНИЕ ГРУППЫ..." value={groupName} onChange={(e) => setGroupName(e.target.value)} onKeyDown={handleKeyDown} autoFocus />
                            <div className="group-selection-list">
                                {chats.filter(c => c.type === 'USER').map(c => (
                                    <div key={c.id} className={`selection-item ${selectedForGroup.includes(c.name) ? 'selected' : ''}`} onClick={() => toggleGroupParticipant(c.name)}>{c.name}</div>
                                ))}
                            </div>
                            <button className="raya-btn-mini full-width" onClick={handleCreateGroupAction}>СОЗДАТЬ [ENTER]</button>
                        </div>
                    ) : (
                        <div className="chat-search-container">
                            <span className="search-icon">&gt;</span>
                            <input type="text" className="chat-search-input" placeholder="ПОИСК ПО CITIZEN ID..." value={searchQuery} onChange={handleSearchChange} />
                        </div>
                    )
                )}

                <main className="raya-body no-padding">
                    <div className="chat-items-container">
                        {viewMode === 'chats' ? (
                            <>
                                {searchResults.map((id) => (
                                    <div key={id} className="chat-item search-result" onClick={() => onStartChat(id)}>
                                        <div className="chat-item-status online"></div>
                                        <div className="chat-item-details">
                                            <div className="chat-item-name">{id}</div>
                                        </div>
                                    </div>
                                ))}

                                {chats.map((chat) => (
                                    <div key={chat.id} className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''} ${chat.unread ? 'unread' : ''}`} onClick={() => onSelectChat(chat)}>
                                        <div className="chat-item-status">
                                            {chat.unread && <span className="unread-marker">!</span>}
                                        </div>
                                        <div className="chat-item-details">
                                            <div className="chat-item-name">{chat.name}</div>
                                        </div>
                                        <div className="chat-item-actions">
                                            <button className="delete-chat-btn" onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}>[X]</button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            archiveItems.map((item) => (
                                <div key={item.id} className={`chat-item archive-item ${selectedChat?.id === item.id ? 'active' : ''}`} onClick={() => onSelectArchive(item)}>
                                    <div className="chat-item-status archive-status"></div>
                                    <div className="chat-item-details">
                                        <div className="chat-item-name">{item.name}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ChatList;
