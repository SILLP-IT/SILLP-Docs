// --------------------------------------------------------------------------
// Periodic Site Visit Report — own state, own Supabase table
// (periodic_site_visits), own storage path, own submit/poll/approve/reject
// flow. Kept fully separate from the architectural form's script.js so
// nothing here can collide with its IDs or global state.
//
// Supports the same two-stage flow as Multiple Aspects: fill on-site and
// either Submit directly, or Save to Pending if some detail needs adding
// later back at the office; the office user can then resume that draft
// from the Pending submissions list (which reloads the whole form exactly
// as saved, including photos) and Submit from there.
// --------------------------------------------------------------------------

const PERIODIC_APPROVE_WEBHOOK_URL = 'https://studioinfinite.app.n8n.cloud/webhook/approve-periodic-report';
const PERIODIC_REJECT_WEBHOOK_URL  = 'https://studioinfinite.app.n8n.cloud/webhook/reject-periodic-report';

const PERIODIC_TABLE = 'periodic_site_visits';
const PERIODIC_STORAGE_BUCKET = 'site-photos'; // reuses the same bucket, under a periodic/ prefix

let periodicPhotos = [];       // [{ type: 'new'|'existing', file?, name?, url?, dataUrl }]
let periodicCurrentVisitId = null;
let periodicCurrentDraftId = null;   // set when resuming a pending draft; null for a fresh submission
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
      periodicPhotos.push({ type: 'new', file: file, name: file.name, dataUrl: ev.target.result });
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
  const pendingBtn = document.getElementById('per-pending-btn');
  const hint = document.getElementById('per-submit-hint');
  if (!btn) return;
  const valid = isPeriodicFormValid();
  btn.disabled = !valid;
  if (pendingBtn) pendingBtn.disabled = !valid;
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
// Upload NEW photos only (existing ones already have a URL and pass
// through untouched) and return the full flat list of public URLs.
// --------------------------------------------------------------------------
async function uploadPeriodicPhotos() {
  const urls = [];
  for (const p of periodicPhotos) {
    if (p.type === 'existing') {
      urls.push(p.url);
      continue;
    }
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

function buildPeriodicPayload(photoUrls, status) {
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
    status: status || 'submitted'
  };
}

// --------------------------------------------------------------------------
// Save to Pending — insert (first save) or update (already-a-draft) with
// status 'pending'. Does NOT trigger the n8n automation (only a real
// Submit, transitioning status into 'submitted', does that).
// --------------------------------------------------------------------------
async function handlePeriodicSavePending() {
  const btn = document.getElementById('per-pending-btn');
  if (!btn) return;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (!supabaseClient) throw new Error('Supabase client not initialized.');

    const photoUrls = await uploadPeriodicPhotos();
    const payload = buildPeriodicPayload(photoUrls, 'pending');

    if (periodicCurrentDraftId) {
      const { error } = await supabaseClient
        .from(PERIODIC_TABLE)
        .update(payload)
        .eq('id', periodicCurrentDraftId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseClient
        .from(PERIODIC_TABLE)
        .insert([payload])
        .select('id');
      if (error) throw error;
      periodicCurrentDraftId = inserted[0].id;
    }

    alert('Saved. You can find this under "Pending submissions" to continue later.');
    btn.disabled = false;
    btn.textContent = originalText;
    loadPeriodicPendingList();

  } catch (err) {
    console.error('Save to pending failed:', err);
    alert('Could not save: ' + (err.message || 'Unknown error'));
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// --------------------------------------------------------------------------
// Pending list (fetch + render + resume)
// --------------------------------------------------------------------------
async function loadPeriodicPendingList() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from(PERIODIC_TABLE)
      .select('id, project_name, visit_date, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const section = document.getElementById('per-pending-section');
    const list = document.getElementById('per-pending-list');
    if (!section || !list) return;

    if (!data || data.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = data.map(row => `
      <div class="obs-card" style="cursor:pointer;" onclick="resumePeriodicDraft('${row.id}')">
        <div class="obs-card-hdr" style="border-bottom:none;">
          <span class="obs-num">
            <span class="obs-dot"></span>${row.project_name || 'Untitled'}
          </span>
          <span class="field-hint">${row.visit_date || ''}</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load pending list:', err);
  }
}

async function resumePeriodicDraft(id) {
  try {
    const { data, error } = await supabaseClient
      .from(PERIODIC_TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;

    periodicCurrentDraftId = id;

    document.getElementById('per-project-name').value = data.project_name || '';
    document.getElementById('per-project-code').value = data.project_code || '';
    document.getElementById('per-site-address').value = data.site_address || '';
    document.getElementById('per-visit-date').value = data.visit_date || '';
    document.getElementById('per-project-architect').value = data.project_architect || '';
    document.getElementById('per-site-engineer').value = data.site_engineer || '';
    document.getElementById('per-prepared-by').value = data.prepared_by || '';
    document.getElementById('per-progress-notes').value = data.progress_notes || '';
    document.getElementById('per-pending-clarifications').value = data.pending_clarifications || '';

    periodicPhotos = Array.isArray(data.photos)
      ? data.photos.map(url => ({ type: 'existing', url, dataUrl: url }))
      : [];
    renderPeriodicPhotoGrid();

    updatePeriodicSubmitState();
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Failed to resume draft:', err);
    alert('Could not load this saved submission: ' + (err.message || 'Unknown error'));
  }
}

// --------------------------------------------------------------------------
// Submit flow
// --------------------------------------------------------------------------
function handlePeriodicSubmit() {
  document.getElementById('perConfirmModal').classList.add('open');
}

function closePeriodicConfirm() {
  document.getElementById('perConfirmModal').classList.remove('open');
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
    const payload = buildPeriodicPayload(photoUrls, 'submitted');

    let visitId;
    if (periodicCurrentDraftId) {
      const { error } = await supabaseClient
        .from(PERIODIC_TABLE)
        .update(payload)
        .eq('id', periodicCurrentDraftId);
      if (error) throw error;
      visitId = periodicCurrentDraftId;
    } else {
      const { data: inserted, error } = await supabaseClient
        .from(PERIODIC_TABLE)
        .insert([payload])
        .select('id');
      if (error) throw error;
      visitId = inserted[0].id;
    }

    periodicCurrentVisitId = visitId;
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
loadPeriodicPendingList();