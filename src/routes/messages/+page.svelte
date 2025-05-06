<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  // Data structures
  let chats: any[] = [];
  let currentChat: any = null;
  let messages: any[] = [];
  let newMessage = '';
  let isLoadingChats = true;
  let isLoadingMessages = false;
  let error = '';
  let unreadCounts: Record<string, number> = {}; // Track unread counts per chat
  
  // Debug info
  let debugLogs: string[] = [];
  let showDebug = true;
  
  // Function to add debug logs
  function debug(message: string) {
    const timestamp = new Date().toISOString().substr(11, 12);
    debugLogs = [...debugLogs, `[${timestamp}] ${message}`];
    console.log(`[DEBUG] ${message}`);
  }
  
  // Subscribe to navigation to reload when chat changes via URL
  $: chatId = $page.url.searchParams.get('id');
  $: if (chatId && chatId !== currentChat?.id) {
    loadChat(chatId);
  }
  
  // Check if user is logged in and is a hiring manager
  $: isHiringManager = $userStore.profile?.account_type === 'hiring_manager';
  
  onMount(async () => {
    debug('Component mounted');
    if (!$userStore.loggedIn) {
      debug('User not logged in, redirecting to login page');
      goto('/login');
      return;
    }
    
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    await loadChats();
    
    // Setup real-time subscription
    const channelA = supabase
      .channel('messages-changes')
      .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'messages' }, 
          handleNewMessage)
      .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chats' },
          handleChatUpdate)
      .subscribe((status) => {
        debug(`Realtime subscription status: ${status}`);
      });
      
    return () => {
      debug('Unsubscribing from realtime updates');
      supabase.removeChannel(channelA);
    };
  });
  
  // Handle new messages coming in via real-time
  async function handleNewMessage(payload: any) {
    debug(`New message received via realtime: ${JSON.stringify(payload.new)}`);
    
    const newMsg = payload.new;
    
    // Only add to current messages if it belongs to the active chat
    if (currentChat && newMsg.chat_id === currentChat.id) {
      messages = [...messages, newMsg];
      
      // Auto scroll to bottom when new message arrives
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-wrapper');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 50);
      
      // Mark as read if not sent by current user
      if (newMsg.sender_id !== $userStore.user?.id) {
        await markMessageAsRead(newMsg.id);
        
        // Send browser notification if the tab is not active
        if (document.hidden && "Notification" in window) {
          showNotification("New Message", `You received a new message from ${getOtherParticipant(currentChat).name}`);
        }
      }
    } else if (newMsg.sender_id !== $userStore.user?.id) {
      // If it's a message for another chat, increment unread count
      const chatId = newMsg.chat_id;
      unreadCounts[chatId] = (unreadCounts[chatId] || 0) + 1;
      
      // Send notification
      const relevantChat = chats.find(c => c.id === chatId);
      if (relevantChat && document.hidden && "Notification" in window) {
        const sender = getOtherParticipant(relevantChat).name;
        showNotification("New Message", `${sender} sent you a message`);
      }
    }
    
    // Update the chat list to show the latest message
    await loadChats();
  }
  
  // Handle chat updates
  function handleChatUpdate(payload: any) {
    debug(`Chat updated via realtime: ${JSON.stringify(payload.new)}`);
    
    // Refresh the chat list to get updated last_message_at, etc.
    loadChats();
  }
  
  // Load all chats for the current user
  async function loadChats() {
    debug('Loading chats');
    isLoadingChats = true;
    error = '';
    
    try {
      const currentUserId = $userStore.user?.id;
      if (!currentUserId) {
        throw new Error('User not found');
      }
      
      const queryField = isHiringManager ? 'hiring_manager_id' : 'job_seeker_id';
      
      const { data, error: dbError } = await supabase
        .from('chats')
        .select(`
          *,
          hiring_manager:hiring_manager_id (user_id, full_name, avatar_url),
          job_seeker:job_seeker_id (user_id, full_name, avatar_url),
          job:job_id (id, title, company_name)
        `)
        .eq(queryField, currentUserId)
        .order('last_message_at', { ascending: false });
      
      if (dbError) throw dbError;
      
      debug(`Loaded ${data?.length || 0} chats`);
      
      // Fetch last messages for each chat
      if (data && data.length > 0) {
        for (const chat of data) {
          const { data: lastMessage, error: msgError } = await supabase
            .from('messages')
            .select('content, sender_id, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (!msgError && lastMessage) {
            chat.last_message = lastMessage.content;
            chat.last_sender_id = lastMessage.sender_id;
          }
          
          // Get unread count for this chat
          const { data: unreadData, error: countError } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('chat_id', chat.id)
            .eq('sender_id', isHiringManager 
              ? chat.job_seeker.user_id 
              : chat.hiring_manager.user_id)
            .is('read_at', null);
          
          if (!countError) {
            unreadCounts[chat.id] = unreadData?.length || 0;
          }
        }
      }
      
      chats = data || [];
      
      // If we have chats but no current chat, load the first one
      if (chats.length > 0 && !currentChat) {
        if (chatId) {
          await loadChat(chatId);
        } else {
          await loadChat(chats[0].id);
          // Update URL to include the chat ID
          const url = new URL(window.location.href);
          url.searchParams.set('id', chats[0].id);
          history.replaceState(null, '', url.toString());
        }
      }
      
    } catch (err: any) {
      error = `Error loading chats: ${err.message}`;
      debug(`Error: ${error}`);
    } finally {
      isLoadingChats = false;
    }
  }
  
  // Load a specific chat and its messages
  async function loadChat(chatId: string) {
    if (!chatId) return;
    
    debug(`Loading chat ${chatId}`);
    
    // Set loading state
    isLoadingMessages = true;
    error = '';
    
    // Update URL to reflect selected chat
    const url = new URL(window.location.href);
    url.searchParams.set('id', chatId);
    history.replaceState(null, '', url.toString());
    
    try {
      // Find selected chat from the list
      const selectedChat = chats.find(chat => chat.id === chatId);
      if (!selectedChat) {
        throw new Error('Chat not found');
      }
      
      // Set current chat
      currentChat = selectedChat;
      
      // Fetch messages for this chat
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (messageError) throw messageError;
      
      messages = messageData || [];
      debug(`Loaded ${messages.length} messages for chat ${chatId}`);
      
      // Mark unread messages as read
      if (unreadCounts[chatId] > 0) {
        await markChatAsRead();
      }
      
      // Auto scroll to bottom of messages
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-wrapper');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
      
    } catch (err: any) {
      error = `Error loading chat: ${err.message}`;
      debug(`Error: ${error}`);
    } finally {
      isLoadingMessages = false;
    }
  }
  
  // Mark all unread messages in the current chat as read
  async function markChatAsRead() {
    if (!currentChat) return;
    
    debug('Marking messages as read');
    
    try {
      const otherUserId = isHiringManager 
        ? currentChat.job_seeker.user_id 
        : currentChat.hiring_manager.user_id;
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_id', currentChat.id)
        .eq('sender_id', otherUserId)
        .is('read_at', null);
      
      if (updateError) throw updateError;
      
      // Update local messages to show as read
      messages = messages.map(msg => {
        if (msg.sender_id !== $userStore.user?.id && !msg.read_at) {
          return { ...msg, read_at: new Date().toISOString() };
        }
        return msg;
      });
      
      // Update unread count for this chat
      unreadCounts[currentChat.id] = 0;
      
    } catch (err: any) {
      debug(`Error marking messages as read: ${err.message}`);
    }
  }
  
  // Mark a single message as read
  async function markMessageAsRead(messageId: string) {
    debug(`Marking message ${messageId} as read`);
    
    try {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
      
      if (updateError) throw updateError;
      
      // Update local message
      messages = messages.map(msg => {
        if (msg.id === messageId) {
          return { ...msg, read_at: new Date().toISOString() };
        }
        return msg;
      });
      
    } catch (err: any) {
      debug(`Error marking message as read: ${err.message}`);
    }
  }
  
  // Send a new message
  async function sendMessage() {
    if (!newMessage.trim() || !currentChat) return;
    
    debug(`Sending message: ${newMessage}`);
    
    try {
      const messageData = {
        chat_id: currentChat.id,
        sender_id: $userStore.user?.id,
        content: newMessage,
        delivered_at: new Date().toISOString(),
        read_at: null
      };
      
      // Add message to DB
      const { data: messageResult, error: messageError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
      
      if (messageError) throw messageError;
      
      debug(`Message sent with ID: ${messageResult.id}`);
      
      // Update chat's last_message_at
      const { error: chatError } = await supabase
        .from('chats')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentChat.id);
      
      if (chatError) throw chatError;
      
      // Clear input
      newMessage = '';
      
      // Scroll to bottom after sending
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-wrapper');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 50);
      
    } catch (err: any) {
      error = `Error sending message: ${err.message}`;
      debug(`Error: ${error}`);
    }
  }
  
  // Format date for messages
  function formatMessageTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Format date for chat list
  function formatChatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }
  
  // Get the other participant's details
  function getOtherParticipant(chat: any) {
    if (isHiringManager) {
      return {
        name: chat.job_seeker?.full_name || 'Job Seeker',
        avatar: chat.job_seeker?.avatar_url,
        initial: (chat.job_seeker?.full_name || 'J')[0],
        userId: chat.job_seeker.user_id
      };
    } else {
      return {
        name: chat.hiring_manager?.full_name || 'Hiring Manager',
        avatar: chat.hiring_manager?.avatar_url,
        initial: (chat.hiring_manager?.full_name || 'H')[0],
        userId: chat.hiring_manager.user_id
      };
    }
  }
  
  // Handle enter key to send message
  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
  
  // Create a new chat with a job seeker (hiring manager only)
  async function startNewChat(jobSeekerId: string, jobId: string) {
    // Implementation for starting a new chat would go here
    // This is just a placeholder for the feature
  }
  
  // Function to show browser notification
  function showNotification(title: string, body: string) {
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: body,
        icon: "/favicon.png" // Make sure this path exists
      });
      
      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
  
  // View applicant profile (for hiring managers only)
  function viewApplicantProfile(userId: string) {
    if (isHiringManager && userId) {
      goto(`/profile/job-seeker/${userId}`);
    }
  }
  
  // Handle messages container scroll (for implementing read receipts)
  function handleMessagesScroll() {
    // Can be used to implement "mark as read when scrolled into view" feature
    // Currently just a placeholder for the scroll event
  }
</script>

<svelte:head>
  <title>Messages | HiringHub</title>
</svelte:head>

<div class="messages-container">
  <!-- Chat list sidebar -->
  <div class="chat-list">
    <div class="chat-list-header">
      <h2>Conversations</h2>
      {#if isHiringManager}
        <a href="/messages/new" class="btn-new-chat" title="Start a new conversation">
          <span>+</span>
        </a>
      {/if}
    </div>
    
    {#if isLoadingChats}
      <div class="loading-state">Loading conversations...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else if chats.length === 0}
      <div class="empty-state">
        <p>No conversations yet.</p>
        {#if isHiringManager}
          <p class="empty-hint">Start reaching out to job seekers to find the perfect candidate!</p>
        {:else}
          <p class="empty-hint">When hiring managers contact you, conversations will appear here.</p>
        {/if}
      </div>
    {:else}
      <ul class="chat-items">
        {#each chats as chat}
          {@const otherParticipant = getOtherParticipant(chat)}
          {@const hasUnread = unreadCounts[chat.id] > 0}
          <li 
            class="chat-item {currentChat?.id === chat.id ? 'active' : ''} {hasUnread ? 'unread' : ''}" 
            on:click={() => loadChat(chat.id)}
          >
            <div class="chat-avatar">
              {#if otherParticipant.avatar}
                <img src={otherParticipant.avatar} alt={otherParticipant.name} />
              {:else}
                <div class="avatar-placeholder">{otherParticipant.initial}</div>
              {/if}
            </div>
            <div class="chat-info">
              <div class="chat-header">
                <h3 class="chat-name">{otherParticipant.name}</h3>
                <span class="chat-time">{formatChatTime(chat.last_message_at || chat.created_at)}</span>
              </div>
              <div class="chat-job-title">{chat.job?.title || 'No job specified'}</div>
              <div class="chat-preview">
                {#if chat.last_message}
                  {#if chat.last_sender_id === $userStore.user?.id}
                    <span class="self-message">You: </span>
                  {/if}
                  {chat.last_message.length > 25 ? chat.last_message.substring(0, 25) + '...' : chat.last_message}
                {:else}
                  <i>No messages yet</i>
                {/if}
              </div>
            </div>
            {#if hasUnread}
              <div class="unread-badge">{unreadCounts[chat.id]}</div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  
  <!-- Message area -->
  <div class="message-area">
    {#if !currentChat}
      <div class="no-chat-selected">
        <div class="no-chat-message">
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start messaging.</p>
        </div>
      </div>
    {:else}
      <!-- Chat header -->
      {@const otherParticipant = getOtherParticipant(currentChat)}
      <div class="message-header">
        <div class="participant-info">
          <div class="participant-avatar">
            {#if otherParticipant.avatar}
              <img src={otherParticipant.avatar} alt={otherParticipant.name} />
            {:else}
              <div class="avatar-placeholder">{otherParticipant.initial}</div>
            {/if}
          </div>
          <div>
            <!-- Make participant name clickable for hiring managers -->
            {#if isHiringManager}
              <h3 class="participant-name clickable" on:click={() => viewApplicantProfile(otherParticipant.userId)}>
                {otherParticipant.name}
              </h3>
            {:else}
              <h3>{otherParticipant.name}</h3>
            {/if}
            <!-- Show job title more prominently -->
            {#if currentChat.job}
              <p class="job-title">Regarding: <strong>{currentChat.job.title}</strong></p>
              <p class="company-name">{currentChat.job.company_name || ''}</p>
            {/if}
          </div>
        </div>
        
        {#if currentChat.job}
          <a href="/jobs/{currentChat.job.id}" class="view-job-link">
            View Job
          </a>
        {/if}
      </div>
      
      <!-- Messages -->
      <div class="messages-wrapper" on:scroll={handleMessagesScroll}>
        {#if isLoadingMessages}
          <div class="loading-state">Loading messages...</div>
        {:else if messages.length === 0}
          <div class="empty-messages">
            <p>No messages yet. Be the first to send a message!</p>
          </div>
        {:else}
          <div class="message-list">
            {#each messages as message}
              {@const isSent = message.sender_id === $userStore.user?.id}
              <div class="message {isSent ? 'sent' : 'received'}">
                <div class="message-content">{message.content}</div>
                <div class="message-meta">
                  <span class="message-time">{formatMessageTime(message.created_at)}</span>
                  {#if isSent}
                    <span class="message-status">
                      {#if message.read_at}
                        <span class="status-read">Read</span>
                      {:else if message.delivered_at}
                        <span class="status-delivered">Delivered</span>
                      {:else}
                        <span class="status-sending">Sent</span>
                      {/if}
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Message input -->
      <div class="message-input-area">
        <textarea 
          class="message-input" 
          placeholder="Type a message..." 
          bind:value={newMessage}
          on:keydown={handleKeyPress}
        ></textarea>
        <button class="send-button" on:click={sendMessage} disabled={!newMessage.trim()}>
          Send
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Debug panel -->
  {#if showDebug}
    <div class="debug-panel">
      <div class="debug-header">
        <h4>Debug Logs</h4>
        <button class="toggle-debug" on:click={() => { showDebug = !showDebug }}>Hide</button>
      </div>
      <div class="debug-content">
        {#each debugLogs as log}
          <div class="debug-log">{log}</div>
        {/each}
      </div>
    </div>
  {:else}
    <button class="show-debug" on:click={() => { showDebug = true }}>Show Debug</button>
  {/if}
</div>

<style>
  .messages-container {
    display: flex;
    height: calc(100vh - 180px);
    min-height: 500px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    overflow: hidden;
  }
  
  .chat-list {
    width: 300px;
    border-right: 1px solid var(--border-color);
    background-color: var(--surface-color);
    display: flex;
    flex-direction: column;
    overflow: hidden; /* Remove overflow from container */
  }
  
  .message-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0; /* Ensure flex item can shrink below content size */
  }
  
  .messages-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md);
    background-color: var(--background-color, #fff);
    min-height: 200px; /* Ensure there's always space for messages */
  }
  
  .message-input-area {
    display: flex;
    padding: var(--spacing-md);
    border-top: 1px solid var(--border-color);
    background-color: var(--surface-color);
    position: sticky;
    bottom: 0;
    z-index: 10;
  }
  
  .chat-list-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background-color: var(--surface-color);
    z-index: 5;
  }
  
  .chat-list-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .chat-items {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
  }
  
  .chat-item {
    display: flex;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .chat-item:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }
  
  .chat-item.active {
    background-color: rgba(var(--primary-color-rgb), 0.1);
    border-left: 3px solid var(--primary-color);
  }
  
  .chat-item.unread {
    background-color: rgba(var(--primary-color-rgb), 0.05);
    font-weight: 500;
  }
  
  .chat-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: var(--spacing-md);
    flex-shrink: 0;
  }
  
  .chat-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-color);
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
  }
  
  .chat-info {
    flex: 1;
    min-width: 0;
  }
  
  .chat-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  
  .chat-name {
    margin: 0;
    font-size: 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .chat-time {
    font-size: 0.75rem;
    color: var(--text-muted-color);
    white-space: nowrap;
  }
  
  .chat-job-title {
    font-size: 0.875rem;
    color: var(--primary-color);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .chat-preview {
    font-size: 0.875rem;
    color: var(--text-muted-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .no-chat-selected {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background-color: var(--background-color, #fff);
  }
  
  .no-chat-message {
    text-align: center;
    max-width: 300px;
    padding: var(--spacing-lg);
  }
  
  .no-chat-message h3 {
    margin-top: 0;
    color: var(--text-color);
  }
  
  .no-chat-message p {
    color: var(--text-muted-color);
  }
  
  .message-header {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    background-color: var(--surface-color);
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .participant-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .participant-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
  }
  
  .participant-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .participant-name.clickable {
    cursor: pointer;
    color: var(--primary-color);
    transition: color 0.2s;
  }
  
  .participant-name.clickable:hover {
    text-decoration: underline;
    color: var(--primary-color-dark);
  }
  
  .job-title {
    margin: 2px 0;
    font-size: 0.9rem;
    color: var(--primary-color);
  }
  
  .company-name {
    margin: 2px 0;
    font-size: 0.8rem;
    color: var(--text-muted-color);
  }
  
  .view-job-link {
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.9rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
    transition: background-color 0.2s;
  }
  
  .view-job-link:hover {
    background-color: var(--primary-color-light, rgba(var(--primary-color-rgb), 0.1));
    text-decoration: none;
  }
  
  .empty-messages {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted-color);
    font-style: italic;
  }
  
  .message-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .message {
    max-width: 70%;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    position: relative;
    word-break: break-word;
  }
  
  .message.sent {
    align-self: flex-end;
    background-color: var(--primary-color);
    color: white;
    border-bottom-right-radius: 4px;
  }
  
  .message.received {
    align-self: flex-start;
    background-color: var(--surface-secondary-color, #f3f4f6);
    color: var(--text-color);
    border-bottom-left-radius: 4px;
  }
  
  .message-meta {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spacing-xs);
    margin-top: 4px;
    font-size: 0.75rem;
  }
  
  .message.sent .message-meta {
    color: rgba(255, 255, 255, 0.7);
  }
  
  .message.received .message-meta {
    color: var(--text-muted-color);
  }
  
  .message-status {
    display: inline-flex;
  }
  
  .status-read {
    color: var(--success-text-color, #16a34a);
  }
  
  .status-delivered {
    color: var(--info-text-color, #0369a1);
  }
  
  .status-sending {
    color: var(--text-muted-color);
  }
  
  .message-input {
    flex: 1;
    min-height: 50px;
    max-height: 150px;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    resize: none;
    font-family: inherit;
    font-size: inherit;
    margin-right: var(--spacing-sm);
  }
  
  .message-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  }
  
  .send-button {
    padding: 0 var(--spacing-md);
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 500;
    align-self: flex-end;
    height: 40px;
    min-width: 80px;
  }
  
  .send-button:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .send-button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  
  /* Loading and error states */
  .loading-state,
  .error-state,
  .empty-state {
    padding: var(--spacing-lg);
    text-align: center;
    color: var(--text-muted-color);
  }
  
  .error-state {
    color: var(--error-text-color, #b91c1c);
  }
  
  .empty-hint {
    font-size: 0.875rem;
    margin-top: var(--spacing-md);
  }
  
  /* Debug panel */
  .debug-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 400px;
    max-height: 300px;
    background-color: rgba(0, 0, 0, 0.85);
    color: #fff;
    border-top-left-radius: var(--border-radius);
    z-index: 1000;
    font-family: monospace;
    font-size: 12px;
  }
  
  .debug-header {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background-color: #333;
    border-top-left-radius: var(--border-radius);
  }
  
  .debug-header h4 {
    margin: 0;
    font-size: 14px;
  }
  
  .toggle-debug,
  .show-debug {
    background: none;
    border: none;
    color: #aaa;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 12px;
  }
  
  .toggle-debug:hover,
  .show-debug:hover {
    color: #fff;
  }
  
  .show-debug {
    position: fixed;
    bottom: 0;
    right: 0;
    background-color: #333;
    padding: 5px 10px;
    border-top-left-radius: var(--border-radius);
    z-index: 1000;
  }
  
  .debug-content {
    overflow-y: auto;
    max-height: 260px;
    padding: 8px;
  }
  
  .debug-log {
    padding: 2px 0;
    border-bottom: 1px solid #333;
  }
  
  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .messages-container {
      flex-direction: column;
      height: calc(100vh - 140px);
    }
    
    .chat-list {
      width: 100%;
      height: 40%;
      min-height: 180px;
      border-right: none;
      border-bottom: 1px solid var(--border-color);
    }
    
    .message-area {
      height: 60%;
      min-height: 250px;
    }
    
    .messages-wrapper {
      min-height: 150px;
    }
    
    .message-input-area {
      padding: var(--spacing-sm);
    }
    
    .message-input {
      min-height: 40px;
      max-height: 80px;
    }
    
    .send-button {
      min-width: 60px;
    }
    
    /* Ensure message content fits on smaller screens */
    .message {
      max-width: 85%;
    }
  }
  
  .unread-badge {
    background-color: var(--primary-color);
    color: white;
    border-radius: 50%;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    margin-left: var(--spacing-sm);
  }
  
  .self-message {
    font-style: italic;
    color: var(--text-light-color);
  }
  
  .btn-new-chat {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 32px;
    height: 32px;
    background-color: var(--primary-color);
    color: white;
    border-radius: 50%;
    text-decoration: none;
    font-weight: bold;
    transition: background-color 0.2s;
  }
  
  .btn-new-chat:hover {
    background-color: var(--primary-color-dark);
  }
  
  .participant-info h3 {
    margin: 0;
    font-size: 1.1rem;
  }
</style> 