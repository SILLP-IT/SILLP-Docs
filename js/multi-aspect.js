// --------------------------------------------------------------------------
// Multiple Aspects Site Report — own state, own Supabase table
// (multi_aspect_site_visits). Supports a two-stage flow:
//   - On site: fill everything, add a colour photo per observation, then
//     either Submit directly, or Save to Pending if the graphical image
//     will be added later back at the office.
//   - In the office: pick the visit from the Pending list (loads the full
//     form back exactly as saved), add the graphical image to whichever
//     observation(s) need it, then Submit.
// Each observation keeps its own issue/location/conclusion/action_by and
// its own photos array — never merged with another observation.
// --------------------------------------------------------------------------

// TODO: fill these in once the multi-aspect n8n webhook workflow is built.
const MA_APPROVE_WEBHOOK_URL = 'https://studioinfinite.app.n8n.cloud/webhook/approve-multi-aspect-report';
const MA_REJECT_WEBHOOK_URL  = 'https://studioinfinite.app.n8n.cloud/webhook/reject-multi-aspect-report';

const MA_TABLE = 'multi_aspect_site_visits';
const MA_STORAGE_BUCKET = 'site-photos'; // reuses the same bucket, under a multi-aspect/ prefix

let maObsCount = 0;
let maObsData = {};        // { [obsId]: { issue, location, conclusion, actionBy, photos: [{type:'existing',url} | {type:'new',file,name,dataUrl}] } }
let maCurrentPhotoTarget = null;
let maCurrentDraftId = null;   // set when resuming a pending draft; null for a fresh submission
let maCurrentVisitId = null;   // set once inserted/updated, used for the report-wait/approve/reject overlay
let maPollInterval = null;

// --------------------------------------------------------------------------
// Observation cards
// --------------------------------------------------------------------------
function maRenderEmptyState() {
  const list = document.getElementById('ma-obs-list');
  if (!list) return;
  if (Object.keys(maObsData).length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-ico">&#128269;</span>
        <p>No observations added yet</p>
        <p class="sub">Tap "+ add observation" below to log the first one</p>
      </div>
    `;
  }
}

function addMaObs(existing) {
  const emptyEl = document.querySelector('#ma-obs-list .empty-state');
  if (emptyEl) emptyEl.remove();

  maObsCount++;
  const id = maObsCount;
  maObsData[id] = existing || { issue: '', location: '', conclusion: '', actionBy: '', photos: [] };

  const div = document.createElement('div');
  div.className = 'obs-card';
  div.id = 'ma-obs-' + id;
  div.innerHTML = `
    <div class="obs-card-hdr">
      <span class="obs-num"><span class="obs-dot"></span>Observation ${id}</span>
      <button class="obs-del" onclick="removeMaObs(${id})">&#x2715; remove</button>
    </div>
    <div class="obs-body">
      <div class="photo-drop" onclick="triggerMaPhoto(${id})" id="ma-drop-${id}">
        <span class="ico">&#128247;</span>
        <p>Tap to add a photo</p>
        <p class="hint">Colour site photo now; graphical image can be added later, or now too</p>
      </div>
      <div class="photo-grid" id="ma-preview-${id}"></div>
      <div class="field">
        <label>Issue</label>
        <textarea id="ma-issue-${id}" placeholder="What was observed / needs addressing"></textarea>
      </div>
      <div class="field">
        <label>Location</label>
        <input type="text" id="ma-location-${id}" placeholder="e.g. Model villa Balcony 239">
      </div>
      <div class="field">
        <label>Conclusion</label>
        <textarea id="ma-conclusion-${id}" placeholder="Resolution / decision reached"></textarea>
      </div>
      <div class="field">
        <label>Action by</label>
        <input type="text" id="ma-action-by-${id}" placeholder="e.g. Site team">
      </div>
    </div>
  `;
  document.getElementById('ma-obs-list').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (existing) {
    document.getElementById('ma-issue-' + id).value = existing.issue || '';
    document.getElementById('ma-location-' + id).value = existing.location || '';
    document.getElementById('ma-conclusion-' + id).value = existing.conclusion || '';
    document.getElementById('ma-action-by-' + id).value = existing.actionBy || '';
    maRenderMaPhotoGrid(id);
  }

  ['ma-issue-' + id, 'ma-location-' + id, 'ma-conclusion-' + id, 'ma-action-by-' + id].forEach(fid => {
    const el = document.getElementById(fid);
    if (el) {
      el.addEventListener('input', updateMaSubmitState);
      el.addEventListener('change', updateMaSubmitState);
    }
  });

  updateMaSubmitState();
}

function removeMaObs(id) {
  const el = document.getElementById('ma-obs-' + id);
  if (el) el.remove();
  delete maObsData[id];
  maRenderEmptyState();
  updateMaSubmitState();
}

// --------------------------------------------------------------------------
// Photo capture (per-observation, mixed existing + newly-picked)
// --------------------------------------------------------------------------
function triggerMaPhoto(id) {
  maCurrentPhotoTarget = id;
  document.getElementById('maPhotoSheet').classList.add('open');
}

function closeMaPhotoSheet() {
  document.getElementById('maPhotoSheet').classList.remove('open');
}

function chooseMaPhotoSource(source) {
  closeMaPhotoSheet();
  if (source === 'camera') {
    document.getElementById('ma-file-input-camera').click();
  } else {
    document.getElementById('ma-file-input-gallery').click();
  }
}

function handleMaPhotoFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !maCurrentPhotoTarget) return;
  const id = maCurrentPhotoTarget;
  if (!maObsData[id]) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function (ev) {
      maObsData[id].photos.push({ type: 'new', file: file, name: file.name, dataUrl: ev.target.result });
      maRenderMaPhotoGrid(id);
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('ma-file-input-camera').addEventListener('change', function (e) {
  handleMaPhotoFiles(e.target.files);
  this.value = '';
});
document.getElementById('ma-file-input-gallery').addEventListener('change', function (e) {
  handleMaPhotoFiles(e.target.files);
  this.value = '';
});

function maRenderMaPhotoGrid(id) {
  const grid = document.getElementById('ma-preview-' + id);
  if (!grid || !maObsData[id]) return;
  grid.innerHTML = maObsData[id].photos.map((p, idx) => {
    const src = p.type === 'existing' ? p.url : p.dataUrl;
    return `
      <div class="photo-thumb">
        <img src="${src}" alt="Observation photo" onclick="openLightbox('${src}')">
        <button class="thumb-clear" onclick="removeMaPhoto(${id}, ${idx})">&#x2715;</button>
      </div>
    `;
  }).join('');
}

function removeMaPhoto(id, index) {
  if (!maObsData[id]) return;
  maObsData[id].photos.splice(index, 1);
  maRenderMaPhotoGrid(id);
}

// --------------------------------------------------------------------------
// Form validation
// --------------------------------------------------------------------------
const MA_REQUIRED_FIELDS = [
  'ma-project-name', 'ma-project-code', 'ma-site-location', 'ma-visit-date',
  'ma-visit-time', 'ma-prepared-by'
];

function maGetVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function isMaFormValid() {
  for (const id of MA_REQUIRED_FIELDS) {
    if (!maGetVal(id)) return false;
  }
  if (Object.keys(maObsData).length === 0) return false;
  for (const id of Object.keys(maObsData)) {
    if (!maGetVal('ma-issue-' + id)) return false;
  }
  return true;
}

function updateMaSubmitState() {
  const pendingBtn = document.getElementById('ma-pending-btn');
  const submitBtn = document.getElementById('ma-submit-btn');
  const hint = document.getElementById('ma-submit-hint');
  if (!submitBtn) return;
  const valid = isMaFormValid();
  submitBtn.disabled = !valid;
  if (pendingBtn) pendingBtn.disabled = !valid;
  if (hint) hint.classList.toggle('show', false); // hint stays visible always via CSS default; keep simple
  if (hint) hint.style.display = valid ? 'none' : 'block';
}

MA_REQUIRED_FIELDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateMaSubmitState);
    el.addEventListener('change', updateMaSubmitState);
  }
});

// --------------------------------------------------------------------------
// Build payload
// --------------------------------------------------------------------------
async function maUploadNewPhotos(id) {
  const obs = maObsData[id];
  const urls = [];
  for (const p of obs.photos) {
    if (p.type === 'existing') {
      urls.push(p.url);
      continue;
    }
    const safeName = p.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `multi-aspect/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient
      .storage
      .from(MA_STORAGE_BUCKET)
      .upload(path, p.file, { upsert: false });
    if (error) {
      console.error('Multi-aspect photo upload failed:', error);
      throw new Error('Photo upload failed: ' + error.message);
    }
    const { data: publicUrlData } = supabaseClient
      .storage
      .from(MA_STORAGE_BUCKET)
      .getPublicUrl(path);
    urls.push(publicUrlData.publicUrl);
  }
  return urls;
}

async function maBuildObservationsPayload() {
  const result = [];
  for (const id of Object.keys(maObsData)) {
    const photoUrls = await maUploadNewPhotos(id);
    result.push({
      issue: maGetVal('ma-issue-' + id),
      location: maGetVal('ma-location-' + id),
      conclusion: maGetVal('ma-conclusion-' + id),
      action_by: maGetVal('ma-action-by-' + id),
      photos: photoUrls
    });
  }
  return result;
}

function maBuildPayload(observationsPayload, status) {
  return {
    project_name: maGetVal('ma-project-name'),
    project_code: maGetVal('ma-project-code'),
    site_location: maGetVal('ma-site-location'),
    visit_date: maGetVal('ma-visit-date') || null,
    visit_time: maGetVal('ma-visit-time') || null,
    architects_present: maGetVal('ma-architects-present'),
    prepared_by: maGetVal('ma-prepared-by'),
    approved_by: maGetVal('ma-approved-by'),
    observations: observationsPayload,
    status: status
  };
}

// --------------------------------------------------------------------------
// Save to Pending
// --------------------------------------------------------------------------
async function handleMaSavePending() {
  const btn = document.getElementById('ma-pending-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (!supabaseClient) throw new Error('Supabase client not initialized.');

    const observationsPayload = await maBuildObservationsPayload();
    const payload = maBuildPayload(observationsPayload, 'pending');

    if (maCurrentDraftId) {
      const { error } = await supabaseClient
        .from(MA_TABLE)
        .update(payload)
        .eq('id', maCurrentDraftId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabaseClient
        .from(MA_TABLE)
        .insert([payload])
        .select('id');
      if (error) throw error;
      maCurrentDraftId = inserted[0].id;
    }

    alert('Saved. You can find this under "Pending submissions" to continue later.');
    btn.disabled = false;
    btn.textContent = originalText;
    maLoadPendingList();

  } catch (err) {
    console.error('Save to pending failed:', err);
    alert('Could not save: ' + (err.message || 'Unknown error'));
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// --------------------------------------------------------------------------
// Submit
// --------------------------------------------------------------------------
function handleMaSubmit() {
  document.getElementById('maConfirmModal').classList.add('open');
}

function closeMaConfirm() {
  document.getElementById('maConfirmModal').classList.remove('open');
}

async function confirmMaSubmit() {
  closeMaConfirm();

  const btn = document.getElementById('ma-submit-btn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Uploading photos & submitting...';

  try {
    if (!supabaseClient) throw new Error('Supabase client not initialized.');

    const observationsPayload = await maBuildObservationsPayload();
    const payload = maBuildPayload(observationsPayload, 'submitted');

    let visitId;
    if (maCurrentDraftId) {
      const { error } = await supabaseClient
        .from(MA_TABLE)
        .update(payload)
        .eq('id', maCurrentDraftId);
      if (error) throw error;
      visitId = maCurrentDraftId;
    } else {
      const { data: inserted, error } = await supabaseClient
        .from(MA_TABLE)
        .insert([payload])
        .select('id');
      if (error) throw error;
      visitId = inserted[0].id;
    }

    maCurrentVisitId = visitId;
    startMaReportWait();

  } catch (err) {
    console.error('Multi-aspect submission failed:', err);
    alert('Submission failed: ' + (err.message || 'Unknown error'));
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// --------------------------------------------------------------------------
// Pending list (fetch + render + resume)
// --------------------------------------------------------------------------
async function maLoadPendingList() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from(MA_TABLE)
      .select('id, project_name, visit_date, visit_time, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const section = document.getElementById('ma-pending-section');
    const list = document.getElementById('ma-pending-list');
    if (!data || data.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = data.map(row => `
      <div class="obs-card" style="cursor:pointer;" onclick="maResumeDraft('${row.id}')">
        <div class="obs-card-hdr" style="border-bottom:none;">
          <span class="obs-num">
            <span class="obs-dot"></span>${row.project_name || 'Untitled'}
          </span>
          <span class="field-hint">${row.visit_date || ''} ${row.visit_time || ''}</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load pending list:', err);
  }
}

async function maResumeDraft(id) {
  try {
    const { data, error } = await supabaseClient
      .from(MA_TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;

    // Reset current form state
    document.getElementById('ma-obs-list').innerHTML = '';
    maObsData = {};
    maObsCount = 0;
    maCurrentDraftId = id;

    document.getElementById('ma-project-name').value = data.project_name || '';
    document.getElementById('ma-project-code').value = data.project_code || '';
    document.getElementById('ma-site-location').value = data.site_location || '';
    document.getElementById('ma-visit-date').value = data.visit_date || '';
    document.getElementById('ma-visit-time').value = data.visit_time || '';
    document.getElementById('ma-architects-present').value = data.architects_present || '';
    document.getElementById('ma-prepared-by').value = data.prepared_by || '';
    document.getElementById('ma-approved-by').value = data.approved_by || '';

    const observations = Array.isArray(data.observations) ? data.observations : [];
    observations.forEach(obs => {
      addMaObs({
        issue: obs.issue || '',
        location: obs.location || '',
        conclusion: obs.conclusion || '',
        actionBy: obs.action_by || '',
        photos: (obs.photos || []).map(url => ({ type: 'existing', url }))
      });
    });

    if (observations.length === 0) maRenderEmptyState();
    updateMaSubmitState();

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Failed to resume draft:', err);
    alert('Could not load this saved submission: ' + (err.message || 'Unknown error'));
  }
}

// --------------------------------------------------------------------------
// Report wait / preview / approve / reject
// --------------------------------------------------------------------------
function startMaReportWait() {
  document.getElementById('maReportOverlay').classList.add('open');
  document.getElementById('maReportWaiting').style.display = 'flex';
  document.getElementById('maReportReady').style.display = 'none';

  let fakeProgress = 5;
  updateMaProgressBar(fakeProgress);

  maPollInterval = setInterval(async () => {
    if (fakeProgress < 90) {
      fakeProgress += Math.random() * 6;
      updateMaProgressBar(Math.min(fakeProgress, 90));
    }

    try {
      const { data, error } = await supabaseClient
        .from(MA_TABLE)
        .select('final_file_url, status')
        .eq('id', maCurrentVisitId)
        .single();

      if (error) throw error;

      if (data && data.final_file_url) {
        clearInterval(maPollInterval);
        updateMaProgressBar(100);
        setTimeout(() => showMaReportReady(data.final_file_url), 400);
      }
    } catch (err) {
      console.error('Multi-aspect polling error:', err);
    }
  }, 3000);
}

function updateMaProgressBar(pct) {
  const fill = document.getElementById('maProgressFill');
  const label = document.getElementById('maProgressPct');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = Math.round(pct) + '%';
}

// --------------------------------------------------------------------------
// showMaReportReady — same iOS Safari fix as script.js/periodic.js: the
// preview container is made visible first, and the iframe's src is only
// set on the next paint (double requestAnimationFrame). Setting src in the
// same tick the container becomes visible makes iOS Safari's built-in PDF
// viewer freeze on page 1 with a stale/zero height. Also wires up the
// "open in a new tab" fallback link, which works on every platform as a
// guaranteed escape hatch.
// --------------------------------------------------------------------------
function showMaReportReady(fileUrl) {
  document.getElementById('maReportWaiting').style.display = 'none';
  document.getElementById('maReportReady').style.display = 'flex';

  const link = document.getElementById('maReportOpenNewTab');
  if (link) {
    link.href = fileUrl;
    link.style.display = 'block';
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('maReportFrame').src = fileUrl;
    });
  });
}

async function handleMaApprove() {
  const approveBtn = document.getElementById('maApproveBtn');
  const rejectBtn = document.getElementById('maRejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  approveBtn.textContent = 'Approving...';

  try {
    const resp = await fetch(MA_APPROVE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: maCurrentVisitId })
    });
    if (!resp.ok) throw new Error('Approve request failed: ' + resp.status);

    alert('Report approved!');
    window.location.reload();

  } catch (err) {
    console.error('Multi-aspect approve failed:', err);
    alert('Could not approve the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = 'Approve';
  }
}

async function handleMaReject() {
  if (!confirm('This will permanently delete this submission and its photos. You will need to fill the form again. Continue?')) return;

  const approveBtn = document.getElementById('maApproveBtn');
  const rejectBtn = document.getElementById('maRejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  rejectBtn.textContent = 'Rejecting...';

  try {
    const resp = await fetch(MA_REJECT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: maCurrentVisitId })
    });
    if (!resp.ok) throw new Error('Reject request failed: ' + resp.status);

    alert('Submission rejected and removed. Please fill the form again.');
    window.location.reload();

  } catch (err) {
    console.error('Multi-aspect reject failed:', err);
    alert('Could not reject the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    rejectBtn.textContent = 'Reject & Redo';
  }
}

// Initial state
maRenderEmptyState();
updateMaSubmitState();
maLoadPendingList();