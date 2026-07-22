"use client";

// Request permission for native system notifications (Desktop + Android/Mobile)
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações de sistema.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (err) {
      console.warn("Erro ao solicitar permissão de notificação:", err);
    }
  }

  return false;
};

// Sends native notification to device status bar / desktop banner
export const sendDeviceNotification = (title: string, body: string) => {
  // Vibration pattern on supported devices (Android phones, etc.)
  if (navigator.vibrate) {
    try {
      navigator.vibrate([200, 100, 200, 100, 200]);
    } catch (e) {}
  }

  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notification = new Notification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo.png",
        tag: 'chat-msg-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200],
      } as any);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.warn("Erro ao disparar notificação de sistema:", err);
    }
  }
};

// Plays sound alert for incoming chat messages
export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // First high tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.18);

    // Second higher tone shortly after
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 120);
  } catch (e) {
    console.warn('Erro ao reproduzir som de notificação:', e);
  }
};