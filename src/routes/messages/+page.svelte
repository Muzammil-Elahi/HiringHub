<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';
  import { goto, pushState, replaceState } from '$app/navigation';
  import { page } from '$app/stores';
  import VideoCallModal from '$lib/components/VideoCallModal.svelte';
  
  // Data structures
  let chats: any[] = [];
  let currentChat: any = null;
  let messages: any[] = [];
  let newMessage = '';
  let isLoadingChats = true;
  let isLoadingMessages = false;
  let error = '';
  let unreadCounts: Record<string, number> = {}; // Track unread counts per chat

  // Call state
  let isInCall = false;
  let callType: 'video' | 'audio' = 'video';
  let incomingCall: {chatId: string, callerId: string, callerName: string, type: 'video' | 'audio'} | null = null;
  let isCallInitiator = false;
  let callChannel: any = null;
  let micEnabled = true;
  let cameraEnabled = true;
  
  // Audio notification elements
  let messageSound: HTMLAudioElement;
  let callSound: HTMLAudioElement;
  let soundsLoaded = false;
  
  // Accessibility related elements
  let messagesEndRef: HTMLElement;
  let chatInputRef: HTMLTextAreaElement;
  let chatListRef: HTMLElement;
  
  // Subscribe to navigation to reload when chat changes via URL
  $: chatId = $page.url.searchParams.get('id');
  $: if (chatId && chatId !== currentChat?.id) {
    loadChat(chatId);
    
    // When chat changes, update the channel filter
    try {
        // Remove old channel and create new one with updated filter
        const newChannel = supabase
          .channel('realtime-messages')
          .on(
            'postgres_changes',
            { 
              event: '*',
              schema: 'public', 
              table: 'messages',
            },
            (payload) => {
              if (payload.eventType === 'INSERT' && payload.new) {
                processNewMessage(payload.new);
              }
            }
          )
          .on(
            'postgres_changes',
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'chats'
            },
            () => {
              loadChats().catch(err => console.error('Error reloading chats:', err));
            }
          )
          .subscribe();
    } catch (error) {
      console.error('Error updating real-time channel:', error);
    }
  }
  
  // Check if user is logged in and is a hiring manager
  $: isHiringManager = $userStore.profile?.account_type === 'hiring_manager';
  
  // Setup function to initialize messages
  async function setupMessages() {
    if (!$userStore.loggedIn) {
      goto('/login');
      return;
    }
    
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    
    // Initialize audio elements
    if (typeof Audio !== 'undefined') {
      messageSound = new Audio('/sounds/message.mp3');
      callSound = new Audio('/sounds/call.mp3');
      callSound.loop = true;
      soundsLoaded = true;
    }
    
    await loadChats();
    setupCallListeners();
  }
  
  // When the component mounts
  onMount(() => {
    // Run setup asynchronously
    setupMessages();
    
    // Add visibility change listener for better read receipts
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Improved realtime subscription approach
    const channel = supabase
      .channel('realtime-messages')
      .on(
        'postgres_changes',
        { 
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public', 
          table: 'messages',
          filter: currentChat ? `chat_id=eq.${currentChat.id}` : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            processNewMessage(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'chats'
        },
        () => {
          loadChats().catch(err => console.error('Error reloading chats:', err));
        }
      )
      .subscribe();
    
    // Return synchronous cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
      cleanupCallListeners();
      
      // Stop any playing sounds
      if (soundsLoaded) {
        callSound.pause();
        messageSound.pause();
      }
    };
  });
  
  // Handle document visibility changes
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && currentChat) {
      // Mark any unread messages as read when tab becomes visible
      if (unreadCounts[currentChat.id] > 0) {
        markChatAsRead().catch(err => {
          console.error('Error marking messages as read on visibility change:', err);
        });
      }
    }
  }
  
  // Updated function to process new messages with improved checks and sound
  function processNewMessage(newMsg: any) {
    // Notify user if they're looking at a different chat or tab is not focused
    if ((!currentChat || newMsg.chat_id !== currentChat.id) && newMsg.sender_id !== $userStore.user?.id) {
      // Find the chat in our list
      const chat = chats.find(c => c.id === newMsg.chat_id);
      if (chat) {
        const sender = isHiringManager ? chat.job_seeker?.full_name : chat.hiring_manager?.full_name;
        showNotification(`New message from ${sender || 'Someone'}`, newMsg.content);
        
        // Play message sound
        if (soundsLoaded) {
          messageSound.play().catch(err => console.error('Error playing message sound:', err));
        }
      }
    }
    
    // Update UI for active chat
    if (currentChat && newMsg.chat_id === currentChat.id) {
      // Add to messages array if not already there
      if (!messages.some(m => m.id === newMsg.id)) {
        messages = [...messages, newMsg];
        
        // Auto scroll and announce new message for screen readers
        setTimeout(() => {
          scrollToBottom();
          
          // Announce new message for screen readers
          if (newMsg.sender_id !== $userStore.user?.id) {
            const chatPartner = getChatPartnerName(currentChat);
            announceNewMessage(`New message from ${chatPartner}`);
          }
        }, 50);
        
        // Mark as read if from other user and we're viewing the chat
        if (newMsg.sender_id !== $userStore.user?.id && document.visibilityState === 'visible') {
          markMessageAsRead(newMsg.id).catch(err => {
            console.error('Error marking message as read:', err);
          });
        }
      }
    }
    
    // Update unread counts and chats list regardless
    loadChats().catch(err => {
      console.error('Error updating chats after new message:', err);
    });
  }
  
  // Helper function to announce messages to screen readers
  function announceNewMessage(message: string) {
    const announcement = document.getElementById('sr-announcement');
    if (announcement) {
      announcement.textContent = message;
    }
  }
  
  // Helper to scroll to bottom of messages
  function scrollToBottom() {
    if (messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: 'smooth' });
    }
  }
  
  // Function to get chat partner name for better announcements
  function getChatPartnerName(chat: any): string {
    if (!chat) return 'Someone';
    return isHiringManager ? 
      (chat.job_seeker?.full_name || 'Job Seeker') : 
      (chat.hiring_manager?.full_name || 'Hiring Manager');
  }
  
  // Load all chats for the current user
  async function loadChats() {
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
        const chatIdFromUrl = $page.url.searchParams.get('id');
        if (chatIdFromUrl) {
          await loadChat(chatIdFromUrl);
        } else if (chats[0]) {
          await loadChat(chats[0].id);
          // Update URL to include the chat ID using SvelteKit navigation
          const url = new URL(window.location.href);
          url.searchParams.set('id', chats[0].id);
          replaceState(url.toString(), {});
        }
      }
      
    } catch (err: any) {
      error = `Error loading chats: ${err.message}`;
    } finally {
      isLoadingChats = false;
    }
  }
  
  // Load a specific chat and its messages
  async function loadChat(chatId: string) {
    if (!chatId) return;
    
    // debug(`Loading chat ${chatId}`);
    
    // Set loading state
    isLoadingMessages = true;
    error = '';
    
    // Update URL to reflect selected chat using SvelteKit navigation
    const url = new URL(window.location.href);
    url.searchParams.set('id', chatId);
    
    // Use replaceState from $app/navigation instead of history.replaceState
    replaceState(url.toString(), {});
    
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
      // debug(`Loaded ${messages.length} messages for chat ${chatId}`);
      
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
      // debug(`Error: ${error}`);
    } finally {
      isLoadingMessages = false;
    }
  }
  
  // Mark all unread messages in the current chat as read
  async function markChatAsRead() {
    if (!currentChat) return;
    
    // debug('Marking messages as read');
    
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
      // debug(`Error marking messages as read: ${err.message}`);
    }
  }
  
  // Mark a single message as read
  async function markMessageAsRead(messageId: string) {
    // debug(`Marking message ${messageId} as read`);
    
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
      // debug(`Error marking message as read: ${err.message}`);
    }
  }
  
  // Send a new message
  async function sendMessage() {
    if (!newMessage.trim() || !currentChat) return;
    
    // debug(`Sending message: ${newMessage}`);
    const originalMessage = newMessage.trim(); // Store the message text
    
    try {
      // Clear input immediately to improve perceived performance
      newMessage = '';
      
      const messageData = {
        chat_id: currentChat.id,
        sender_id: $userStore.user?.id,
        content: originalMessage,
        created_at: new Date().toISOString(),
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
      
      // debug(`Message sent with ID: ${messageResult.id}`);
      
      // Add the message to local messages array immediately
      messages = [...messages, messageResult];
      
      // Update chat's last_message_at
      const { error: chatError } = await supabase
        .from('chats')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentChat.id);
      
      if (chatError) throw chatError;
      
      // Scroll to bottom after sending
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-wrapper');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 50);
      
    } catch (err: any) {
      error = `Error sending message: ${err.message}`;
      // If there was an error, restore the message
      newMessage = originalMessage;
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
  
  // Enhanced function to show browser notification
  function showNotification(title: string, body: string) {
    if (!("Notification" in window)) {
      return; // Notifications not supported
    }
    
    if (Notification.permission === "granted" && document.visibilityState !== 'visible') {
      const notification = new Notification(title, {
        body: body.length > 50 ? body.substring(0, 47) + '...' : body,
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
  
  // Call management
  function setupCallListeners() {
    if (!$userStore.loggedIn || !$userStore.user) return;
    
    // Create a channel for incoming call notifications
    callChannel = supabase
      .channel(`user-calls:${$userStore.user.id}`)
      .on('broadcast', { event: 'call-request' }, (payload) => {
        handleIncomingCall(payload);
      })
      .on('broadcast', { event: 'call-canceled' }, () => {
        incomingCall = null;
      })
      .subscribe();
  }
  
  function cleanupCallListeners() {
    if (callChannel) {
      supabase.removeChannel(callChannel);
    }
  }
  
  // Handle incoming call with sound
  function handleIncomingCall(payload: any) {
    const { chatId, callerId, callerName, type } = payload.payload;
    
    // Only accept calls if not currently in a call
    if (!isInCall) {
      incomingCall = {
        chatId,
        callerId,
        callerName,
        type
      };
      
      // Also show browser notification
      const notificationTitle = `Incoming ${type} call`;
      const notificationBody = `${callerName} is calling you`;
      showNotification(notificationTitle, notificationBody);
      
      // Play call sound
      if (soundsLoaded) {
        callSound.play().catch(err => console.error('Error playing call sound:', err));
      }
    } else {
      // Automatically reject if already in a call
      rejectCall();
    }
  }
  
  // Toggle mic for incoming call
  function toggleMicBeforeAnswer() {
    micEnabled = !micEnabled;
  }
  
  // Toggle camera for incoming call
  function toggleCameraBeforeAnswer() {
    cameraEnabled = !cameraEnabled;
  }
  
  // Initiate a call
  function startCall(type: 'video' | 'audio') {
    if (!isHiringManager) {
      alert("Only hiring managers can initiate calls.");
      return;
    }
    
    if (!currentChat) {
      alert("No active conversation selected.");
      return;
    }
    
    callType = type;
    isInCall = true;
    isCallInitiator = true;
    
    // Notify job seeker of incoming call
    const otherUser = getOtherParticipant(currentChat);
    
    // Send call notification via Supabase Realtime
    const callRequestChannel = supabase
      .channel(`user-calls:${otherUser.userId}`)
      .subscribe();
      
    setTimeout(() => {
      callRequestChannel.send({
        type: 'broadcast',
        event: 'call-request',
        payload: {
          chatId: currentChat.id,
          callerId: $userStore.user?.id,
          callerName: $userStore.profile?.full_name || 'Hiring Manager',
          type: callType
        }
      });
      
      // Clean up channel after sending
      supabase.removeChannel(callRequestChannel);
    }, 1000);
  }
  
  // Accept an incoming call with current mic/camera settings
  function acceptCall() {
    if (!incomingCall) return;
    
    // Find the chat
    const chat = chats.find(c => c.id === incomingCall?.chatId);
    if (chat) {
      // Set the chat as active if it's not already
      if (!currentChat || currentChat.id !== chat.id) {
        loadChat(chat.id);
      }
      
      // Start the call
      callType = incomingCall.type;
      isInCall = true;
      isCallInitiator = false;
      
      // Stop call sound
      if (soundsLoaded) {
        callSound.pause();
        callSound.currentTime = 0;
      }
      
      incomingCall = null;
    }
  }
  
  // Reject an incoming call
  function rejectCall() {
    if (!incomingCall) return;
    
    // Notify caller that call was rejected
    if (incomingCall.callerId) {
      const callRejectChannel = supabase
        .channel(`user-calls:${incomingCall.callerId}`)
        .subscribe();
        
      setTimeout(() => {
        callRejectChannel.send({
          type: 'broadcast',
          event: 'call-canceled',
          payload: {
            chatId: incomingCall?.chatId,
            rejected: true
          }
        });
        
        // Clean up channel after sending
        supabase.removeChannel(callRejectChannel);
      }, 1000);
    }
    
    // Stop call sound
    if (soundsLoaded) {
      callSound.pause();
      callSound.currentTime = 0;
    }
    
    incomingCall = null;
  }
  
  // Handle call ended
  function handleCallEnded() {
    isInCall = false;
    isCallInitiator = false;
    
    // Reset mic and camera settings to default
    micEnabled = true;
    cameraEnabled = true;
  }
</script>

<svelte:head>
  <title>Messages - HiringHub</title>
  <meta name="description" content="Your conversations with job seekers and hiring managers on HiringHub">
</svelte:head>

<div class="messages-container">
  <!-- Screen reader announcements region -->
  <div id="sr-announcement" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  
  <!-- Left sidebar with chat list -->
  <section class="chat-list-section" aria-labelledby="chat-list-heading">
    <h1 id="chat-list-heading" class="sr-only">Conversations</h1>
    <div class="chat-list-header">
      <h2>Conversations</h2>
    </div>
    
    {#if isLoadingChats}
      <div class="loading-indicator" aria-live="polite">
        <p>Loading conversations...</p>
      </div>
    {:else if error}
      <div class="error-message" role="alert">
        <p>{error}</p>
      </div>
    {:else if chats.length === 0}
      <div class="empty-state" aria-live="polite">
        <p>No conversations yet.</p>
      </div>
    {:else}
      <nav>
        <ul class="chat-list" role="list" bind:this={chatListRef}>
          {#each chats as chat (chat.id)}
            <li>
              <button 
                class="chat-item {currentChat?.id === chat.id ? 'active' : ''}" 
                on:click={() => loadChat(chat.id)}
                aria-current={currentChat?.id === chat.id ? 'page' : undefined}
              >
                <div class="chat-avatar">
                  {#if isHiringManager}
                    <span aria-hidden="true">{chat.job_seeker?.full_name?.charAt(0) || 'U'}</span>
                  {:else}
                    <span aria-hidden="true">{chat.hiring_manager?.full_name?.charAt(0) || 'U'}</span>
                  {/if}
                </div>
                
                <div class="chat-info">
                  <div class="chat-name">
                    {#if isHiringManager}
                      <span>{chat.job_seeker?.full_name || 'Unknown User'}</span>
                    {:else}
                      <span>{chat.hiring_manager?.full_name || 'Unknown User'}</span>
                    {/if}
                    
                    {#if unreadCounts[chat.id] && unreadCounts[chat.id] > 0}
                      <span class="unread-badge" aria-label="{unreadCounts[chat.id]} unread messages">
                        {unreadCounts[chat.id]}
                      </span>
                    {/if}
                  </div>
                  
                  {#if chat.job}
                    <div class="chat-job-info">
                      <span class="job-title-preview">{chat.job.title} at {chat.job.company_name}</span>
                    </div>
                  {/if}
                  
                  <div class="chat-preview">
                    <span>{chat.last_message || 'New conversation'}</span>
                  </div>
                </div>
              </button>
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
  </section>
  
  <!-- Right section with current chat -->
  <section class="chat-main-section" aria-labelledby="current-chat-heading">
    {#if currentChat}
      <header class="chat-header">
        <div class="header-content">
          <h2>{currentChat ? getOtherParticipant(currentChat).name : 'Select a conversation'}</h2>
          
          {#if currentChat && currentChat.job}
            <div class="job-info">
              <a href="/jobs/{currentChat.job.id}" class="job-link">
                {currentChat.job.title} at {currentChat.job.company_name}
              </a>
            </div>
          {/if}
        </div>
        
        {#if currentChat}
          <div class="chat-actions">
            <!-- Only show call buttons for hiring managers -->
            {#if isHiringManager}
              <button 
                type="button" 
                class="call-button"
                aria-label="Start audio call"
                on:click={() => startCall('audio')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </button>
              <button 
                type="button" 
                class="call-button"
                aria-label="Start video call"
                on:click={() => startCall('video')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </button>
            {/if}
          </div>
        {/if}
      </header>
      
      <div 
        class="messages-wrapper" 
        aria-label="Message history" 
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {#if isLoadingMessages}
          <div class="loading-indicator" aria-live="polite">
            <p>Loading messages...</p>
          </div>
        {:else if messages.length === 0}
          <div class="empty-messages" aria-live="polite">
            <p>No messages yet. Start the conversation!</p>
          </div>
        {:else}
          <ul class="message-list">
            {#each messages as message (message.id)}
              <li class="message-item {message.sender_id === $userStore.user?.id ? 'sent' : 'received'}">
                <div 
                  class="message-bubble"
                  role="article"
                  aria-label="{message.sender_id === $userStore.user?.id ? 'You' : getChatPartnerName(currentChat)} sent: {message.content}"
                >
                  <div class="message-content">{message.content}</div>
                  <div class="message-meta">
                    <span class="message-time">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {#if message.sender_id === $userStore.user?.id}
                      <span class="message-status" aria-hidden="true">
                        {message.read ? '✓✓' : '✓'}
                      </span>
                      <span class="sr-only">{message.read ? 'Read' : 'Sent'}</span>
                    {/if}
                  </div>
                </div>
              </li>
            {/each}
          </ul>
          <!-- Message end marker for auto-scrolling -->
          <div bind:this={messagesEndRef} aria-hidden="true"></div>
        {/if}
      </div>
      
      <div class="message-input-container">
        <form 
          on:submit|preventDefault={sendMessage}
          class="message-form"
          aria-label="Send message"
        >
          <div class="input-wrapper">
            <label for="message-input" class="sr-only">Type a message</label>
            <textarea 
              id="message-input"
              bind:this={chatInputRef}
              bind:value={newMessage} 
              placeholder="Type a message..."
              rows="2"
              on:keydown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              aria-label="Type a message"
            ></textarea>
          </div>
          
          <button 
            type="submit" 
            class="send-button" 
            disabled={!newMessage.trim() || isLoadingMessages}
            aria-label="Send message"
          >
            <span aria-hidden="true">➤</span>
          </button>
        </form>
      </div>
    {:else}
      <div class="empty-chat-state">
        <h2 id="current-chat-heading">Select a conversation</h2>
        <p>Choose a conversation from the list to start messaging.</p>
      </div>
    {/if}
  </section>
</div>

<!-- Incoming call modal -->
{#if incomingCall}
  <div class="call-modal-overlay" role="dialog" aria-labelledby="call-modal-title">
    <div class="call-modal">
      <h2 id="call-modal-title">Incoming {incomingCall.type} call</h2>
      <p>From {incomingCall.callerName}</p>
      
      <div class="media-controls">
        {#if incomingCall.type === 'video'}
          <button 
            type="button" 
            class="toggle-button"
            on:click={toggleCameraBeforeAnswer}
            aria-pressed={!cameraEnabled}
          >
            {#if cameraEnabled}
              <span>Turn Camera Off</span>
            {:else}
              <span>Turn Camera On</span>
            {/if}
          </button>
        {/if}
        
        <button 
          type="button" 
          class="toggle-button"
          on:click={toggleMicBeforeAnswer}
          aria-pressed={!micEnabled}
        >
          {#if micEnabled}
            <span>Mute Microphone</span>
          {:else}
            <span>Unmute Microphone</span>
          {/if}
        </button>
      </div>
      
      <div class="call-actions">
        <button 
          type="button" 
          class="answer-button"
          on:click={() => acceptCall()}
        >
          <span>Answer</span>
        </button>
        
        <button 
          type="button" 
          class="decline-button"
          on:click={rejectCall}
        >
          <span>Decline</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Active call component -->
{#if isInCall}
  <VideoCallModal
    chatId={currentChat?.id || ''}
    otherUserId={getOtherParticipant(currentChat).userId}
    callType={callType}
    isHiringManager={isHiringManager}
    isInitiator={isCallInitiator}
    initialMicEnabled={micEnabled}
    initialCameraEnabled={cameraEnabled}
    on:endCall={handleCallEnded}
  />
{/if}

<style>
  /* Screen reader only class */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .messages-container {
    display: grid;
    grid-template-columns: 300px 1fr;
    height: calc(100vh - var(--header-height) - var(--footer-height));
    max-height: calc(100vh - var(--header-height) - var(--footer-height));
    overflow: hidden;
    background-color: var(--background-color);
  }
  
  /* Chat list section */
  .chat-list-section {
    border-right: 1px solid var(--border-color);
    background-color: var(--surface-color);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .chat-list-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .chat-list-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .chat-list {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    height: 100%;
  }
  
  .chat-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%;
    text-align: left;
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
  }
  
  .chat-item:hover, .chat-item:focus {
    background-color: var(--hover-color);
  }
  
  .chat-item:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -2px;
  }
  
  .chat-item.active {
    background-color: var(--active-item-bg-color);
    border-left: 3px solid var(--primary-color);
    font-weight: 500;
  }
  
  .chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
    font-weight: bold;
  }
  
  .chat-info {
    flex: 1;
    min-width: 0;
  }
  
  .chat-name {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  
  .chat-job-info {
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .job-title-preview {
    color: var(--primary-color);
    font-style: italic;
  }
  
  .chat-preview {
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .unread-badge {
    background-color: var(--primary-color);
    color: white;
    border-radius: 50%;
    padding: 0.125rem 0.375rem;
    font-size: 0.75rem;
    font-weight: bold;
  }
  
  /* Chat main section */
  .chat-main-section {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--chat-bg-color, #f5f5f5);
  }
  
  .chat-header {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .header-content {
    display: flex;
    flex-direction: column;
  }
  
  .chat-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .job-info {
    margin-top: 0.25rem;
    font-size: 0.85rem;
  }
  
  .job-link {
    color: var(--primary-color);
    text-decoration: underline;
  }
  
  .job-link:hover {
    text-decoration: underline;
    opacity: 0.8;
  }
  
  .chat-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .call-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .call-button:hover, .call-button:focus {
    background-color: var(--hover-color);
  }
  
  .call-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  /* Messages area */
  .messages-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 220px); /* Fixed height accounting for header and input area */
    height: 100%;
    scroll-behavior: smooth;
  }
  
  .message-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .message-item {
    display: flex;
    margin-bottom: 0.5rem;
  }
  
  .message-item.sent {
    justify-content: flex-end;
  }
  
  .message-bubble {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    position: relative;
  }
  
  .sent .message-bubble {
    background-color: var(--primary-color);
    color: white;
    border-bottom-right-radius: 0.25rem;
  }
  
  .received .message-bubble {
    background-color: var(--surface-color);
    border-bottom-left-radius: 0.25rem;
  }
  
  .message-content {
    margin-bottom: 0.25rem;
    word-wrap: break-word;
  }
  
  .message-meta {
    display: flex;
    justify-content: flex-end;
    font-size: 0.75rem;
    opacity: 0.8;
    gap: 0.25rem;
  }
  
  /* Message input */
  .message-input-container {
    padding: 1rem;
    background-color: var(--surface-color);
    border-top: 1px solid var(--border-color);
  }
  
  .message-form {
    display: flex;
    gap: 0.5rem;
  }
  
  .input-wrapper {
    flex: 1;
  }
  
  textarea {
    width: 100%;
    border-radius: 1.5rem;
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    resize: none;
    font-family: inherit;
    font-size: 1rem;
    background-color: var(--input-bg-color);
  }
  
  textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--focus-ring-color);
  }
  
  .send-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    align-self: flex-end;
  }
  
  .send-button:hover:not(:disabled), .send-button:focus:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .send-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Empty states */
  .empty-state, .empty-messages, .empty-chat-state, .loading-indicator, .error-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
    color: var(--text-color-secondary);
  }
  
  .empty-chat-state {
    background-color: var(--chat-bg-color, #f5f5f5);
  }
  
  /* Call modal */
  .call-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .call-modal {
    background-color: var(--surface-color);
    border-radius: var(--border-radius);
    padding: 2rem;
    width: 400px;
    max-width: 90%;
    text-align: center;
  }
  
  .call-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  
  .answer-button, .decline-button {
    padding: 0.75rem 1.5rem;
    border-radius: var(--border-radius);
    border: none;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .answer-button {
    background-color: var(--success-color, #22c55e);
    color: white;
  }
  
  .decline-button {
    background-color: var(--error-color, #ef4444);
    color: white;
  }
  
  .answer-button:hover, .answer-button:focus,
  .decline-button:hover, .decline-button:focus {
    opacity: 0.9;
  }
  
  .answer-button:focus, .decline-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  /* Responsive styles */
  @media (max-width: 768px) {
    .messages-container {
      grid-template-columns: 1fr;
    }
    
    .chat-list-section {
      display: none;
    }
    
    .chat-list-section.active {
      display: flex;
      position: absolute;
      top: var(--header-height);
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
    }
  }
  
  /* Animation */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
</style> 