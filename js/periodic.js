// --------------------------------------------------------------------------
// Periodic Site Visit Report — own state, own Supabase table
// (periodic_site_visits), own storage path, own submit/poll/approve/reject
// flow. Kept fully separate from the architectural form's script.js so
// nothing here can collide with its IDs or global state.
// --------------------------------------------------------------------------

// TODO: fill these in once the periodic n8n webhook workflow is built
// (Approve / Reject webhook nodes, mirroring APPROVE_WEBHOOK_URL /
// REJECT_WEBHOOK_URL in script.js).
const PERIODIC_APPROVE_WEBHOOK_URL = 'https://studioinfinite.app.n8n.cloud/webhook/approve-periodic-report';
const PERIODIC_REJECT_WEBHOOK_URL  = 'https://studioinfinite.app.n8n.cloud/webhook/reject-periodic-report';

const PERIODIC_TABLE = 'periodic_site_visits';
const PERIODIC_STORAGE_BUCKET = 'site-photos'; // reuses the same bucket, under a periodic/ prefix

let periodicPhotos = [];       // [{ file, name, dataUrl }]
let periodicCurrentVisitId = null;
let periodicPollInterval = null;

// --------------------------------------------------------------------------
// Photo capture (flat list — not grouped by observation)
// --------------------------------------------------------------------------
function triggerPeriodicPhoto() {
  document.getElementById('perPhotoSheet').classList.add('open');
}

function closePeriodicPhotoSheet() {
  document.getElementById('perPhotoSheet').classList.remove('open');
}

function choosePeriodicPhotoSource(source) {
  closePeriodicPhotoSheet();
  if (source === 'camera') {
    document.getElementById('per-file-input-camera').click();
  } else {
    document.getElementById('per-file-input-gallery').click();
  }
}

function handlePeriodicPhotoFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function (ev) {
      periodicPhotos.push({ file: file, name: file.name, dataUrl: ev.target.result });
      renderPeriodicPhotoGrid();
      updatePeriodicSubmitState();
    };
    reader.readAsDataURL(file);
  });
}

function renderPeriodicPhotoGrid() {
  const grid = document.getElementById('per-photo-preview');
  if (!grid) return;
  grid.innerHTML = periodicPhotos.map((p, idx) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Site photo" onclick="openLightbox('${p.dataUrl}')">
      <button class="thumb-clear" onclick="removePeriodicPhoto(${idx})">&#x2715;</button>
    </div>
  `).join('');
}

function removePeriodicPhoto(index) {
  periodicPhotos.splice(index, 1);
  renderPeriodicPhotoGrid();
  updatePeriodicSubmitState();
}

document.getElementById('per-file-input-camera').addEventListener('change', function (e) {
  handlePeriodicPhotoFiles(e.target.files);
  this.value = '';
});

document.getElementById('per-file-input-gallery').addEventListener('change', function (e) {
  handlePeriodicPhotoFiles(e.target.files);
  this.value = '';
});

// --------------------------------------------------------------------------
// Form validation
// --------------------------------------------------------------------------
const PERIODIC_REQUIRED_FIELDS = [
  'per-project-name', 'per-project-code', 'per-visit-date', 'per-site-address',
  'per-project-architect', 'per-site-engineer', 'per-prepared-by', 'per-progress-notes'
];

function periodicGetVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function isPeriodicFormValid() {
  for (const id of PERIODIC_REQUIRED_FIELDS) {
    if (!periodicGetVal(id)) return false;
  }
  return true;
}

function updatePeriodicSubmitState() {
  const btn = document.getElementById('per-submit-btn');
  const hint = document.getElementById('per-submit-hint');
  if (!btn) return;
  const valid = isPeriodicFormValid();
  btn.disabled = !valid;
  if (hint) hint.classList.toggle('show', !valid);
}

PERIODIC_REQUIRED_FIELDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updatePeriodicSubmitState);
    el.addEventListener('change', updatePeriodicSubmitState);
  }
});

// --------------------------------------------------------------------------
// Submit flow
// --------------------------------------------------------------------------
function handlePeriodicSubmit() {
  document.getElementById('perConfirmModal').classList.add('open');
}

function closePeriodicConfirm() {
  document.getElementById('perConfirmModal').classList.remove('open');
}

async function uploadPeriodicPhotos() {
  const urls = [];
  for (const p of periodicPhotos) {
    const safeName = p.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `periodic/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient
      .storage
      .from(PERIODIC_STORAGE_BUCKET)
      .upload(path, p.file, { upsert: false });
    if (error) {
      console.error('Periodic photo upload failed:', error);
      throw new Error('Photo upload failed: ' + error.message);
    }
    const { data: publicUrlData } = supabaseClient
      .storage
      .from(PERIODIC_STORAGE_BUCKET)
      .getPublicUrl(path);
    urls.push(publicUrlData.publicUrl);
  }
  return urls;
}

function buildPeriodicPayload(photoUrls) {
  return {
    project_name: periodicGetVal('per-project-name'),
    project_code: periodicGetVal('per-project-code'),
    site_address: periodicGetVal('per-site-address'),
    visit_date: periodicGetVal('per-visit-date') || null,
    project_architect: periodicGetVal('per-project-architect'),
    site_engineer: periodicGetVal('per-site-engineer'),
    prepared_by: periodicGetVal('per-prepared-by'),
    progress_notes: periodicGetVal('per-progress-notes'),
    pending_clarifications: periodicGetVal('per-pending-clarifications') || null,
    photos: photoUrls,
    status: 'submitted'
  };
}

async function confirmPeriodicSubmit() {
  closePeriodicConfirm();

  const btn = document.getElementById('per-submit-btn');
  const hint = document.getElementById('per-submit-hint');
  const originalBtnText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Uploading photos & submitting...';
  if (hint) {
    hint.textContent = 'Please wait, do not close this page.';
    hint.classList.add('show');
  }

  try {
    if (!supabaseClient) throw new Error('Supabase client not initialized.');

    const photoUrls = await uploadPeriodicPhotos();
    const payload = buildPeriodicPayload(photoUrls);

    const { data: inserted, error } = await supabaseClient
      .from(PERIODIC_TABLE)
      .insert([payload])
      .select('id');
    if (error) throw error;

    periodicCurrentVisitId = inserted[0].id;
    startPeriodicReportWait();

  } catch (err) {
    console.error('Periodic submission failed:', err);
    alert('Submission failed: ' + (err.message || 'Unknown error') + '\nPlease check your connection and try again.');
    btn.disabled = false;
    btn.textContent = originalBtnText;
    if (hint) hint.textContent = 'Fill in all required fields to submit';
    updatePeriodicSubmitState();
  }
}

// --------------------------------------------------------------------------
// Report wait / preview / approve / reject
// --------------------------------------------------------------------------
function startPeriodicReportWait() {
  document.getElementById('perReportOverlay').classList.add('open');
  document.getElementById('perReportWaiting').style.display = 'flex';
  document.getElementById('perReportReady').style.display = 'none';

  let fakeProgress = 5;
  updatePeriodicProgressBar(fakeProgress);

  periodicPollInterval = setInterval(async () => {
    if (fakeProgress < 90) {
      fakeProgress += Math.random() * 6;
      updatePeriodicProgressBar(Math.min(fakeProgress, 90));
    }

    try {
      const { data, error } = await supabaseClient
        .from(PERIODIC_TABLE)
        .select('final_file_url, status')
        .eq('id', periodicCurrentVisitId)
        .single();

      if (error) throw error;

      if (data && data.final_file_url) {
        clearInterval(periodicPollInterval);
        updatePeriodicProgressBar(100);
        setTimeout(() => showPeriodicReportReady(data.final_file_url), 400);
      }
    } catch (err) {
      console.error('Periodic polling error:', err);
    }
  }, 3000);
}

function updatePeriodicProgressBar(pct) {
  const fill = document.getElementById('perProgressFill');
  const label = document.getElementById('perProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = Math.round(pct) + '%';
}

// --------------------------------------------------------------------------
// showPeriodicReportReady — same iOS Safari fix as script.js: the preview
// container is made visible first, and the iframe's src is only set on the
// next paint (double requestAnimationFrame). Setting src in the same tick
// the container becomes visible makes iOS Safari's built-in PDF viewer
// freeze on page 1 with a stale/zero height. Also wires up the "open in a
// new tab" fallback link, which works on every platform as a guaranteed
// escape hatch.
// --------------------------------------------------------------------------
function showPeriodicReportReady(fileUrl) {
  document.getElementById('perReportWaiting').style.display = 'none';
  document.getElementById('perReportReady').style.display = 'flex';

  const link = document.getElementById('perReportOpenNewTab');
  if (link) {
    link.href = fileUrl;
    link.style.display = 'block';
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('perReportFrame').src = fileUrl;
    });
  });
}

async function handlePeriodicApprove() {
  const approveBtn = document.getElementById('perApproveBtn');
  const rejectBtn = document.getElementById('perRejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  approveBtn.textContent = 'Approving...';

  try {
    const resp = await fetch(PERIODIC_APPROVE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: periodicCurrentVisitId })
    });
    if (!resp.ok) throw new Error('Approve request failed: ' + resp.status);

    alert('Report approved!');
    window.location.reload();

  } catch (err) {
    console.error('Periodic approve failed:', err);
    alert('Could not approve the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = 'Approve';
  }
}

async function handlePeriodicReject() {
  if (!confirm('This will permanently delete this submission and its photos. You will need to fill the form again. Continue?')) return;

  const approveBtn = document.getElementById('perApproveBtn');
  const rejectBtn = document.getElementById('perRejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  rejectBtn.textContent = 'Rejecting...';

  try {
    const resp = await fetch(PERIODIC_REJECT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: periodicCurrentVisitId })
    });
    if (!resp.ok) throw new Error('Reject request failed: ' + resp.status);

    alert('Submission rejected and removed. Please fill the form again.');
    window.location.reload();

  } catch (err) {
    console.error('Periodic reject failed:', err);
    alert('Could not reject the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    rejectBtn.textContent = 'Reject & Redo';
  }
}

// Initial state
renderPeriodicPhotoGrid();
updatePeriodicSubmitState();