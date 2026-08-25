(function () {
  const PROFILE_STORAGE_PREFIX = 'profile_';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentCode() {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) return fromUrl.trim();
    const saved = localStorage.getItem('userId');
    return saved ? saved.trim() : '';
  }

  function getProfileStorageKey(code) {
    return PROFILE_STORAGE_PREFIX + code;
  }

  function readProfile(code) {
    const raw = localStorage.getItem(getProfileStorageKey(code));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error('Could not parse profile data', error);
      return null;
    }
  }

  function saveProfile(code, profile) {
    localStorage.setItem(getProfileStorageKey(code), JSON.stringify(profile));
  }

  function attachProfileSystem(studentData, code) {
    const profileButton = document.getElementById('profileButton');
    const profilePopup = document.getElementById('profilePopup');
    const profileClose = document.getElementById('profileClose');
    const profileName = document.getElementById('profileName');
    const profileId = document.getElementById('profileId');
    const profileMobile = document.getElementById('profileMobile');
    const profileEmailText = document.getElementById('profileEmailText');
    const profileAddEmailBtn = document.getElementById('profileAddEmailBtn');
    const profileEditBtn = document.getElementById('profileEditBtn');
    const profileRecoveryForm = document.getElementById('profileRecoveryForm');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const profilePasswordInput = document.getElementById('profilePasswordInput');
    const profilePasswordConfirmInput = document.getElementById('profilePasswordConfirmInput');
    const profileSaveBtn = document.getElementById('profileSaveBtn');
    const profileMessage = document.getElementById('profileMessage');

    if (!profileButton || !profilePopup) return;

    const currentCode = code || getCurrentCode();
    let profileData = readProfile(currentCode) || { recoveryEmail: '', recoveryPassword: '' };
    let isEditing = false;

    function showMessage(text, type) {
      if (!profileMessage) return;
      profileMessage.textContent = text;
      profileMessage.className = 'profile-message ' + (type || 'info');
      profileMessage.style.display = 'block';
    }

    function hideMessage() {
      if (!profileMessage) return;
      profileMessage.textContent = '';
      profileMessage.style.display = 'none';
    }

    function renderProfile() {
      if (profileName) profileName.textContent = studentData?.name || 'Student';
      if (profileId) profileId.textContent = currentCode || '—';
      if (profileMobile) profileMobile.textContent = studentData?.phone || '—';

      const email = (profileData.recoveryEmail || '').trim();
      if (profileEmailText) {
        profileEmailText.innerHTML = email ? escapeHtml(email) : 'No recovery email yet';
      }

      if (profileAddEmailBtn) {
        profileAddEmailBtn.style.display = email ? 'none' : 'inline-flex';
      }

      if (profileEditBtn) {
        profileEditBtn.style.display = email ? 'inline-flex' : 'none';
      }

      if (profileRecoveryForm) {
        profileRecoveryForm.classList.remove('open');
      }

      if (profileEmailInput) profileEmailInput.value = email;
      if (profilePasswordInput) profilePasswordInput.value = '';
      if (profilePasswordConfirmInput) profilePasswordConfirmInput.value = '';
      hideMessage();
    }

    function openPopup() {
      profilePopup.classList.add('show');
      renderProfile();
    }

    function closePopup() {
      profilePopup.classList.remove('show');
      hideMessage();
    }

    function startEdit() {
      isEditing = true;
      if (profileRecoveryForm) profileRecoveryForm.classList.add('open');
      if (profileEmailInput) profileEmailInput.focus();
      if (profilePasswordInput) profilePasswordInput.value = '';
      if (profilePasswordConfirmInput) profilePasswordConfirmInput.value = '';
      hideMessage();
    }

    function saveRecoveryEmail() {
      const email = (profileEmailInput?.value || '').trim();
      const password = profilePasswordInput?.value || '';
      const confirmPassword = profilePasswordConfirmInput?.value || '';

      if (!email || !password || !confirmPassword) {
        showMessage('Please fill in email, password, and confirmation.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showMessage('Passwords do not match.', 'error');
        return;
      }

      profileData = {
        recoveryEmail: email,
        recoveryPassword: password
      };
      saveProfile(currentCode, profileData);
      renderProfile();
      isEditing = false;
      showMessage('Recovery email saved successfully.', 'success');
    }

    profileButton.addEventListener('click', function (event) {
      event.stopPropagation();
      if (profilePopup.classList.contains('show')) {
        closePopup();
      } else {
        openPopup();
      }
    });

    profileClose?.addEventListener('click', function (event) {
      event.stopPropagation();
      closePopup();
    });

    profileAddEmailBtn?.addEventListener('click', function (event) {
      event.stopPropagation();
      isEditing = false;
      if (profileRecoveryForm) profileRecoveryForm.classList.add('open');
      if (profileEmailInput) profileEmailInput.focus();
    });

    profileEditBtn?.addEventListener('click', function (event) {
      event.stopPropagation();
      startEdit();
    });

    profileSaveBtn?.addEventListener('click', function (event) {
      event.stopPropagation();
      saveRecoveryEmail();
    });

    document.addEventListener('click', function (event) {
      if (!profilePopup.contains(event.target) && !profileButton.contains(event.target)) {
        closePopup();
      }
    });

    renderProfile();
  }

  function handleSignIn() {
    const signInForm = document.getElementById('signInForm');
    const signInMessage = document.getElementById('signInMessage');

    if (!signInForm) return;

    signInForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const email = (document.getElementById('recoveryEmail')?.value || '').trim();
      const password = (document.getElementById('recoveryPassword')?.value || '').trim();

      if (!email || !password) {
        if (signInMessage) {
          signInMessage.textContent = 'Please enter your email and password.';
          signInMessage.className = 'auth-message error';
        }
        return;
      }

      let matchedCode = '';
      let matchedFromLocal = false;
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('profile_')) continue;
        const profile = readProfile(key.replace('profile_', ''));
        if (profile && profile.recoveryEmail?.toLowerCase() === email.toLowerCase() && profile.recoveryPassword === password) {
          matchedCode = key.replace('profile_', '');
          matchedFromLocal = true;
          break;
        }
      }

      // Fallback: check Firestore 'students' collection for email/password or recoveryEmail/recoveryPassword
      (async function tryFirestoreLookup() {
        try {
          if (signInMessage) {
            signInMessage.textContent = 'Checking server...';
            signInMessage.className = 'auth-message info';
          }

          const appModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
          const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

          const firebaseConfig = {
            apiKey: "AIzaSyAC1bNuWAD8noagHV2SD0y4PP0ABhxDdqo",
            authDomain: "students-68430.firebaseapp.com",
            projectId: "students-68430",
            storageBucket: "students-68430.firebasestorage.app",
            messagingSenderId: "202641775624",
            appId: "1:202641775624:web:fe2d70e4ec92d62d5b85bd"
          };

          const app = appModule.initializeApp(firebaseConfig);
          const db = fs.getFirestore(app);

          const studentsCol = fs.collection(db, 'students');
          const searchFields = ['email', 'recoveryEmail'];
          const searchValues = [email, email.toLowerCase()];
          let found = null;

          for (const field of searchFields) {
            for (const value of searchValues) {
              const q = fs.query(studentsCol, fs.where(field, '==', value));
              const snaps = await fs.getDocs(q);
              snaps.forEach((docSnap) => {
                const data = docSnap.data();
                if (found) return;
                if (!data) return;
                const savedPassword = data.password || data.recoveryPassword || '';
                if (savedPassword === password) {
                  found = { code: docSnap.id, data };
                }
              });
              if (found) break;
            }
            if (found) break;
          }

          if (!found && !matchedFromLocal) {
            if (signInMessage) {
              signInMessage.textContent = 'The email or password is incorrect.';
              signInMessage.className = 'auth-message error';
            }
            return;
          }
          const matched = found ? found.code : matchedCode;
          if (!matched) {
            if (signInMessage) {
              signInMessage.textContent = 'The email or password is incorrect.';
              signInMessage.className = 'auth-message error';
            }
            return;
          }

          // Verify the student code exists in Firestore when matched from localStorage.
          if (matchedFromLocal && !found) {
            const docRef = fs.doc(db, 'students', matched);
            const docSnap = await fs.getDoc(docRef);
            if (!docSnap.exists()) {
              if (signInMessage) {
                signInMessage.textContent = 'The email or password is incorrect.';
                signInMessage.className = 'auth-message error';
              }
              return;
            }
          }

          localStorage.setItem('userId', matched);
          localStorage.setItem('userName', found?.data?.name || matched);
          localStorage.setItem('savedCode', matched);
          if (signInMessage) {
            signInMessage.textContent = 'Signed in successfully.';
            signInMessage.className = 'auth-message success';
          }
          window.location.href = 'code.html?code=' + encodeURIComponent(matched);
        } catch (err) {
          console.error('Firestore sign-in error:', err);
          if (signInMessage) {
            signInMessage.textContent = 'Server error. Try again later.';
            signInMessage.className = 'auth-message error';
          }
        }
      })();
    });
  }

  window.profileSystem = {
    attachProfileSystem,
    readProfile,
    saveProfile
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleSignIn);
  } else {
    handleSignIn();
  }
})();
