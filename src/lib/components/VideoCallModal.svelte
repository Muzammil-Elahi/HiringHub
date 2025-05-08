<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { supabase } from '$lib/supabaseClient';

  export let chatId: string;
  export let otherUserId: string;
  export let callType: 'video' | 'audio' = 'video';
  export let isHiringManager: boolean = false;
  export let isInitiator: boolean = false;
  export let initialMicEnabled: boolean = true;
  export let initialCameraEnabled: boolean = true;

  // Call states
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let callStatus: 'connecting' | 'connected' | 'ended' | 'failed' = 'connecting';
  let errors: string = '';
  let isMuted: boolean = !initialMicEnabled;
  let isVideoOff: boolean = callType === 'audio' ? true : !initialCameraEnabled;
  let signalChannel: any = null;
  
  // Video elements
  let localVideoElement: HTMLVideoElement;
  let remoteVideoElement: HTMLVideoElement;
  
  const dispatch = createEventDispatcher();
  
  // Update video elements when streams change
  $: if (localStream && localVideoElement) {
    localVideoElement.srcObject = localStream;
  }
  
  $: if (remoteStream && remoteVideoElement) {
    remoteVideoElement.srcObject = remoteStream;
  }
  
  onMount(async () => {
    try {
      await setupMediaDevices();
      setupPeerConnection();
      setupSignaling();
      
      // Apply initial mic and camera states
      if (isMuted && localStream) {
        localStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      
      if (isVideoOff && localStream && callType === 'video') {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
      
      if (isInitiator) {
        await createOffer();
      }
    } catch (err: any) {
      console.error('Error setting up call:', err);
      errors = err.message;
      callStatus = 'failed';
    }
  });

  onDestroy(() => {
    cleanupCall();
  });

  async function setupMediaDevices() {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video'
      };
      
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // For audio-only calls, disable video track if it exists
      if (callType === 'audio' && localStream.getVideoTracks().length > 0) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
    } catch (err) {
      console.error('Error accessing media devices:', err);
      throw new Error('Could not access camera and microphone. Please check your device permissions.');
    }
  }

  function setupPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Add local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection?.addTrack(track, localStream!);
      });
    }
    
    // Set up remote stream
    peerConnection.ontrack = (event) => {
      remoteStream = new MediaStream();
      event.streams[0].getTracks().forEach(track => {
        remoteStream?.addTrack(track);
      });
    };
    
    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };
    
    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
      switch(peerConnection?.connectionState) {
        case 'connected':
          callStatus = 'connected';
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          callStatus = 'ended';
          break;
      }
    };
  }

  function setupSignaling() {
    // Create a realtime channel specific to this chat
    signalChannel = supabase
      .channel(`call:${chatId}`)
      .on('broadcast', { event: 'signal' }, (payload) => {
        handleSignal(payload);
      })
      .subscribe();
  }

  async function createOffer() {
    if (!peerConnection) return;
    
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      sendSignal({
        type: 'offer',
        sdp: peerConnection.localDescription
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      errors = 'Failed to create connection offer.';
      callStatus = 'failed';
    }
  }

  async function handleSignal(payload: any) {
    if (!peerConnection) return;
    
    const { type, sdp, candidate } = payload.payload;
    
    try {
      if (type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendSignal({
          type: 'answer',
          sdp: peerConnection.localDescription
        });
      } 
      else if (type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      } 
      else if (type === 'ice-candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
      else if (type === 'hang-up') {
        endCall();
      }
    } catch (err) {
      console.error('Error handling signal:', err);
      errors = 'Connection error. Please try again.';
      callStatus = 'failed';
    }
  }

  function sendSignal(signal: any) {
    signalChannel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: signal
    });
  }

  function toggleMute() {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        isMuted = !track.enabled;
      });
    }
  }

  function toggleVideo() {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
        isVideoOff = !track.enabled;
      });
    }
  }

  function endCall() {
    // Send hangup signal
    sendSignal({
      type: 'hang-up'
    });
    
    cleanupCall();
    dispatch('callEnded');
  }

  function cleanupCall() {
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close the peer connection
    if (peerConnection) {
      peerConnection.close();
    }
    
    // Cleanup signaling
    if (signalChannel) {
      supabase.removeChannel(signalChannel);
    }
    
    callStatus = 'ended';
  }
</script>

<div class="video-call-modal">
  <div class="call-container">
    <div class="call-header">
      <h3>{callType === 'video' ? 'Video' : 'Audio'} Call</h3>
      <div class="call-status">
        {#if callStatus === 'connecting'}
          <span class="status connecting">Connecting...</span>
        {:else if callStatus === 'connected'}
          <span class="status connected">Connected</span>
        {:else if callStatus === 'ended'}
          <span class="status ended">Call Ended</span>
        {:else if callStatus === 'failed'}
          <span class="status failed">Call Failed</span>
        {/if}
      </div>
      <button class="close-btn" on:click={endCall}>✕</button>
    </div>
    
    <div class="video-container">
      {#if callType === 'video'}
        <div class="video-wrapper remote-video">
          {#if remoteStream}
            <video 
              autoplay 
              playsinline
              bind:this={remoteVideoElement}
            ></video>
          {:else}
            <div class="waiting-remote">
              Waiting for other participant...
            </div>
          {/if}
        </div>
        
        <div class="video-wrapper local-video">
          {#if localStream}
            <video 
              autoplay 
              playsinline 
              muted 
              bind:this={localVideoElement}
            ></video>
            {#if isVideoOff}
              <div class="video-off-indicator">
                Camera Off
              </div>
            {/if}
          {/if}
        </div>
      {:else}
        <!-- Audio call UI -->
        <div class="audio-call-ui">
          <div class="audio-icon">
            <span class="audio-waves">🎤</span>
          </div>
          <div class="audio-status">
            {#if remoteStream}
              Audio call in progress
            {:else}
              Connecting audio...
            {/if}
          </div>
        </div>
      {/if}
    </div>
    
    {#if errors}
      <div class="error-message">
        {errors}
      </div>
    {/if}
    
    <div class="call-controls">
      <button 
        class="control-btn {isMuted ? 'active' : ''}" 
        on:click={toggleMute}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
      
      {#if callType === 'video'}
        <button 
          class="control-btn {isVideoOff ? 'active' : ''}" 
          on:click={toggleVideo}
        >
          {isVideoOff ? '📵' : '📹'}
        </button>
      {/if}
      
      <button class="control-btn end-call" on:click={endCall}>
        📞
      </button>
    </div>
  </div>
</div>

<style>
  .video-call-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .call-container {
    width: 90%;
    max-width: 800px;
    background-color: var(--surface-color, #ffffff);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }
  
  .call-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md, 12px);
    background-color: var(--primary-color, #2563eb);
    color: white;
  }
  
  .call-header h3 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }
  
  .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
  
  .video-container {
    position: relative;
    width: 100%;
    height: 400px;
    background-color: #000;
  }
  
  .video-wrapper {
    position: absolute;
    overflow: hidden;
  }
  
  .remote-video {
    width: 100%;
    height: 100%;
  }
  
  .local-video {
    position: absolute;
    width: 150px;
    height: 100px;
    bottom: 20px;
    right: 20px;
    border: 2px solid white;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .waiting-remote {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: white;
    font-size: 1.2rem;
    background-color: #333;
  }
  
  .video-off-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 0.8rem;
  }
  
  .audio-call-ui {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--spacing-lg, 24px);
    background-color: var(--background-color, #f3f4f6);
  }
  
  .audio-icon {
    font-size: 4rem;
    margin-bottom: var(--spacing-lg, 24px);
  }
  
  .audio-waves {
    display: inline-block;
    animation: pulse 1.5s infinite;
  }
  
  .call-controls {
    display: flex;
    justify-content: center;
    padding: var(--spacing-md, 12px);
    gap: var(--spacing-md, 12px);
    background-color: var(--surface-color, #ffffff);
    border-top: 1px solid var(--border-color, #e5e7eb);
  }
  
  .control-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: none;
    background-color: var(--surface-secondary-color, #f3f4f6);
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .control-btn:hover {
    background-color: var(--surface-hover-color, #e5e7eb);
  }
  
  .control-btn.active {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  .control-btn.end-call {
    background-color: var(--error-text-color, #b91c1c);
    color: white;
    transform: rotate(135deg);
  }
  
  .control-btn.end-call:hover {
    background-color: #9b1c1c;
  }
  
  .error-message {
    padding: var(--spacing-md, 12px);
    margin: var(--spacing-md, 12px);
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border-radius: var(--border-radius, 4px);
  }
  
  .call-status {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  .status.connecting {
    background-color: var(--warning-bg-color, #fef3c7);
    color: var(--warning-text-color, #b45309);
  }
  
  .status.connected {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .status.ended, .status.failed {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @media (max-width: 768px) {
    .video-container {
      height: 300px;
    }
    
    .local-video {
      width: 100px;
      height: 75px;
    }
  }
</style> 